//! 外部编辑器临时文件监听与自动同步。
//!
//! 本模块只依赖 [`SessionManager`]，所有上传下载仍经 `FileTransport` trait 调度。

use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use tauri::Emitter;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

use crate::core::SessionManager;
use crate::enums::app_directory::AppDirectory;
use crate::enums::app_event::AppEvent;
use crate::enums::edit_policy::EditPolicy;
use crate::enums::ErrorCode;
use crate::error::AppError;
use crate::local_fs::{reject_existing_local_link, safe_local_child, validate_local_file_name};
use crate::models::{
    EditorErrorPayload, EditorSessionInvalidPayload, EditorSyncedPayload, RemoteEditSessionInfo,
};

struct EditSession {
    host_id: Uuid,
    remote_path: String,
    file_name: String,
    session_directory: PathBuf,
    local_path: PathBuf,
    lease: Option<std::fs::File>,
    valid: Arc<AtomicBool>,
    _watcher: RecommendedWatcher,
}

impl Drop for EditSession {
    fn drop(&mut self) {
        self.valid.store(false, Ordering::Release);
        drop(self.lease.take());
        let _ = std::fs::remove_dir_all(&self.session_directory);
    }
}

/// 管理外部编辑器临时文件及其监听生命周期。
#[derive(Default)]
pub struct EditSessionManager {
    sessions: Mutex<HashMap<Uuid, EditSession>>,
    start_guard: AsyncMutex<()>,
}

impl EditSessionManager {
    /// 创建空的编辑会话管理器。
    pub fn new() -> Self {
        let root = std::env::temp_dir().join(AppDirectory::RemoteEditRoot.as_str());
        let _ = cleanup_stale_sessions(&root);
        Self::default()
    }

    /// 下载远程文件、建立本地监听并返回可由系统打开的临时文件。
    pub async fn start(
        &self,
        app: tauri::AppHandle,
        session_manager: SessionManager,
        host_id: Uuid,
        remote_path: String,
        source_file_name: String,
    ) -> Result<RemoteEditSessionInfo, AppError> {
        let _start = self.start_guard.lock().await;
        if let Some(session) = self.find_matching_session(host_id, &remote_path) {
            return Ok(session);
        }

        let edit_session_id = Uuid::new_v4();
        let file_name = safe_file_name(&source_file_name)?;
        let root = std::env::temp_dir().join(AppDirectory::RemoteEditRoot.as_str());
        let (session_directory, local_path) =
            session_local_path(&root, &file_name, edit_session_id)?;
        tokio::fs::create_dir_all(&session_directory).await?;
        let lease = acquire_session_lease(&session_directory)?;
        let local_path_text = local_path.to_string_lossy().into_owned();

        let (progress, mut receiver) = tokio::sync::mpsc::channel(16);
        tauri::async_runtime::spawn(async move { while receiver.recv().await.is_some() {} });
        session_manager
            .download_file(host_id, &remote_path, &local_path_text, progress)
            .await?;

        let valid = Arc::new(AtomicBool::new(true));
        let revision = Arc::new(AtomicU64::new(0));
        let upload_guard = Arc::new(AsyncMutex::new(()));
        let watched_path = local_path.clone();
        let callback_app = app.clone();
        let callback_manager = session_manager.clone();
        let callback_remote_path = remote_path.clone();
        let callback_file_name = file_name.clone();
        let callback_valid = valid.clone();
        let callback_revision = revision.clone();
        let callback_upload_guard = upload_guard.clone();

        let mut watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            let event = match result {
                Ok(event) => event,
                Err(error) => {
                    emit_editor_error(
                        &callback_app,
                        host_id,
                        &callback_remote_path,
                        &callback_file_name,
                        AppError::new(ErrorCode::StorageReadFailed, error.to_string()),
                    );
                    return;
                }
            };
            if !callback_valid.load(Ordering::Acquire) || !is_file_change(&event, &watched_path) {
                return;
            }

            let current_revision = callback_revision.fetch_add(1, Ordering::AcqRel) + 1;
            let task_app = callback_app.clone();
            let task_manager = callback_manager.clone();
            let task_remote_path = callback_remote_path.clone();
            let task_file_name = callback_file_name.clone();
            let task_local_path = watched_path.clone();
            let task_valid = callback_valid.clone();
            let task_revision = callback_revision.clone();
            let task_upload_guard = callback_upload_guard.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(
                    EditPolicy::WatchDebounceMilliseconds.value(),
                ))
                .await;
                if !task_valid.load(Ordering::Acquire)
                    || task_revision.load(Ordering::Acquire) != current_revision
                {
                    return;
                }

                let _upload = task_upload_guard.lock().await;
                if !task_valid.load(Ordering::Acquire)
                    || task_revision.load(Ordering::Acquire) != current_revision
                {
                    return;
                }
                if !task_manager.is_connected(host_id).await {
                    task_valid.store(false, Ordering::Release);
                    let _ = task_app.emit(
                        AppEvent::EditorSessionInvalid.as_str(),
                        EditorSessionInvalidPayload {
                            edit_session_id,
                            host_id,
                            file_path: task_remote_path,
                        },
                    );
                    return;
                }

                let (progress, mut receiver) = tokio::sync::mpsc::channel(16);
                tauri::async_runtime::spawn(
                    async move { while receiver.recv().await.is_some() {} },
                );
                let local_path_text = task_local_path.to_string_lossy().into_owned();
                match task_manager
                    .upload_file(host_id, &local_path_text, &task_remote_path, progress)
                    .await
                {
                    Ok(()) => {
                        let _ = task_app.emit(
                            AppEvent::EditorSynced.as_str(),
                            EditorSyncedPayload {
                                host_id,
                                file_path: task_remote_path,
                                file_name: task_file_name,
                                sync_time: chrono::Local::now().format("%H:%M:%S").to_string(),
                            },
                        );
                    }
                    Err(error) => emit_editor_error(
                        &task_app,
                        host_id,
                        &task_remote_path,
                        &task_file_name,
                        error,
                    ),
                }
            });
        })
        .map_err(|error| AppError::new(ErrorCode::StorageReadFailed, error.to_string()))?;
        watcher
            .watch(&session_directory, RecursiveMode::NonRecursive)
            .map_err(|error| AppError::new(ErrorCode::StorageReadFailed, error.to_string()))?;

        self.sessions.lock().insert(
            edit_session_id,
            EditSession {
                host_id,
                remote_path: remote_path.clone(),
                file_name: file_name.clone(),
                session_directory,
                local_path,
                lease: Some(lease),
                valid,
                _watcher: watcher,
            },
        );
        Ok(RemoteEditSessionInfo {
            edit_session_id,
            local_path: local_path_text,
            file_name,
            remote_path,
        })
    }

    /// 返回指定主机当前仍有效的外部编辑会话。
    pub fn list_for_host(&self, host_id: Uuid) -> Vec<RemoteEditSessionInfo> {
        let mut sessions = self.sessions.lock();
        sessions.retain(|_, session| {
            session.valid.load(Ordering::Acquire) && session.local_path.is_file()
        });
        let mut result = sessions
            .iter()
            .filter(|(_, session)| session.host_id == host_id)
            .map(|(id, session)| session_info(*id, session))
            .collect::<Vec<_>>();
        result.sort_by(|left, right| left.file_name.cmp(&right.file_name));
        result
    }

    /// 停止指定编辑会话并删除临时文件。
    pub fn stop(&self, edit_session_id: Uuid) -> bool {
        self.sessions.lock().remove(&edit_session_id).is_some()
    }

    /// 使主机的全部编辑会话失效；断开连接前调用。
    pub fn stop_for_host(&self, app: &tauri::AppHandle, host_id: Uuid) {
        let mut sessions = self.sessions.lock();
        let ids = sessions
            .iter()
            .filter_map(|(id, session)| (session.host_id == host_id).then_some(*id))
            .collect::<Vec<_>>();
        for id in ids {
            if let Some(session) = sessions.remove(&id) {
                let _ = app.emit(
                    AppEvent::EditorSessionInvalid.as_str(),
                    EditorSessionInvalidPayload {
                        edit_session_id: id,
                        host_id,
                        file_path: session.remote_path.clone(),
                    },
                );
            }
        }
    }

    fn find_matching_session(
        &self,
        host_id: Uuid,
        remote_path: &str,
    ) -> Option<RemoteEditSessionInfo> {
        self.sessions.lock().iter().find_map(|(id, session)| {
            (session.host_id == host_id
                && session.remote_path == remote_path
                && session.valid.load(Ordering::Acquire)
                && session.local_path.is_file())
            .then(|| session_info(*id, session))
        })
    }
}

fn cleanup_stale_sessions(root: &Path) -> io::Result<()> {
    let entries = match std::fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };
    for entry in entries {
        let entry = entry?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if Uuid::parse_str(name).is_err()
            || !entry.file_type()?.is_dir()
            || reject_existing_local_link(&entry.path()).is_err()
        {
            continue;
        }
        let lease = open_session_lease(&entry.path())?;
        if fs2::FileExt::try_lock_exclusive(&lease).is_err() {
            continue;
        }
        drop(lease);
        std::fs::remove_dir_all(entry.path())?;
    }
    Ok(())
}

fn open_session_lease(session_directory: &Path) -> io::Result<std::fs::File> {
    OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(session_directory.join(AppDirectory::RemoteEditLease.as_str()))
}

fn acquire_session_lease(session_directory: &Path) -> io::Result<std::fs::File> {
    let lease = open_session_lease(session_directory)?;
    fs2::FileExt::lock_exclusive(&lease)?;
    Ok(lease)
}

fn session_info(id: Uuid, session: &EditSession) -> RemoteEditSessionInfo {
    RemoteEditSessionInfo {
        edit_session_id: id,
        local_path: session.local_path.to_string_lossy().into_owned(),
        file_name: session.file_name.clone(),
        remote_path: session.remote_path.clone(),
    }
}

fn is_file_change(event: &Event, watched_path: &Path) -> bool {
    matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_))
        && event.paths.iter().any(|path| path == watched_path)
}

fn safe_file_name(source: &str) -> Result<String, AppError> {
    validate_local_file_name(source)?;
    Ok(source.to_owned())
}

fn session_local_path(
    root: &Path,
    file_name: &str,
    id: Uuid,
) -> Result<(PathBuf, PathBuf), AppError> {
    let session_directory = safe_local_child(root, &id.simple().to_string())?;
    let local_path = safe_local_child(&session_directory, file_name)?;
    Ok((session_directory, local_path))
}

fn emit_editor_error(
    app: &tauri::AppHandle,
    host_id: Uuid,
    file_path: &str,
    file_name: &str,
    error: AppError,
) {
    let _ = app.emit(
        AppEvent::EditorError.as_str(),
        EditorErrorPayload {
            host_id,
            file_path: file_path.to_owned(),
            file_name: file_name.to_owned(),
            code: error.code,
            message: error.message,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_path_preserves_a_maximum_length_unicode_file_name() {
        let id = Uuid::from_u128(1);
        let file_name = format!("{}😀.txt", "中".repeat(249));
        assert_eq!(file_name.encode_utf16().count(), 255);
        let root = std::env::temp_dir().join("sy-tfm-edit-test");
        let (session_directory, local_path) = session_local_path(&root, &file_name, id)
            .expect("maximum valid file name should remain valid");

        assert_eq!(session_directory, root.join(id.simple().to_string()));
        assert_eq!(
            local_path.file_name().and_then(|name| name.to_str()),
            Some(file_name.as_str())
        );
        assert_eq!(
            local_path
                .file_name()
                .expect("file name")
                .to_string_lossy()
                .encode_utf16()
                .count(),
            255
        );
    }

    #[test]
    fn source_file_name_must_be_a_single_safe_component() {
        assert!(safe_file_name("../../secret.env").is_err());
        assert!(safe_file_name("C:\\secret.env").is_err());
        assert!(safe_file_name("CON.txt").is_err());
        assert_eq!(
            safe_file_name("中文-😀.txt").ok().as_deref(),
            Some("中文-😀.txt")
        );
    }

    #[test]
    fn startup_cleanup_removes_only_managed_session_directories() {
        let root = std::env::temp_dir().join(format!("sy-tfm-cleanup-test-{}", Uuid::new_v4()));
        let managed = root.join(Uuid::new_v4().simple().to_string());
        let unrelated = root.join("keep-me");
        std::fs::create_dir_all(&managed).expect("create managed session directory");
        std::fs::create_dir_all(&unrelated).expect("create unrelated directory");
        std::fs::write(root.join("keep.txt"), b"keep").expect("create unrelated file");

        cleanup_stale_sessions(&root).expect("cleanup should succeed");

        assert!(!managed.exists());
        assert!(unrelated.exists());
        assert!(root.join("keep.txt").exists());
        std::fs::remove_dir_all(root).expect("remove cleanup test root");
    }

    #[test]
    fn startup_cleanup_preserves_a_session_locked_by_another_instance() {
        use fs2::FileExt;

        let root = std::env::temp_dir().join(format!("sy-tfm-lock-test-{}", Uuid::new_v4()));
        let managed = root.join(Uuid::new_v4().simple().to_string());
        std::fs::create_dir_all(&managed).expect("create managed session directory");
        let lease = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(managed.join(AppDirectory::RemoteEditLease.as_str()))
            .expect("create session lock file");
        lease.lock_exclusive().expect("lock active session");

        cleanup_stale_sessions(&root).expect("cleanup should skip locked sessions");

        assert!(managed.exists());
        drop(lease);
        std::fs::remove_dir_all(root).expect("remove lock test root");
    }

    #[test]
    fn active_session_is_reused_and_listed_for_its_host() {
        let manager = EditSessionManager::new();
        let host_id = Uuid::new_v4();
        let edit_session_id = Uuid::new_v4();
        let session_directory =
            std::env::temp_dir().join(format!("sy-tfm-reuse-{edit_session_id}"));
        std::fs::create_dir_all(&session_directory).expect("create edit session directory");
        let local_path = session_directory.join("draft.txt");
        std::fs::write(&local_path, b"draft").expect("test temp file should be writable");
        let watcher = notify::recommended_watcher(|_: notify::Result<Event>| {})
            .expect("test watcher should be created");
        manager.sessions.lock().insert(
            edit_session_id,
            EditSession {
                host_id,
                remote_path: "/home/user/draft.txt".to_string(),
                file_name: "draft.txt".to_string(),
                session_directory,
                local_path: local_path.clone(),
                lease: None,
                valid: Arc::new(AtomicBool::new(true)),
                _watcher: watcher,
            },
        );

        let reused = manager
            .find_matching_session(host_id, "/home/user/draft.txt")
            .expect("active session should be reused");
        assert_eq!(reused.edit_session_id, edit_session_id);
        assert_eq!(reused.local_path, local_path.to_string_lossy());
        assert_eq!(manager.list_for_host(host_id).len(), 1);
        assert!(manager.list_for_host(Uuid::new_v4()).is_empty());
    }
}
