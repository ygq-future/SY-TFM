//! 安全的本地文件系统辅助函数。

use std::fs::OpenOptions;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use uuid::Uuid;

/// 验证单个文件名是否符合严格的 Windows 本地文件名规则。
pub(crate) fn validate_local_file_name(name: &str) -> io::Result<()> {
    let invalid = name.is_empty()
        || matches!(name, "." | "..")
        || name.encode_utf16().count() > 255
        || name.ends_with([' ', '.'])
        || name
            .chars()
            .any(|ch| ch <= '\u{1f}' || ch == '\u{7f}' || "<>:\"/\\|?*".contains(ch))
        || is_windows_device_name(name);

    if invalid {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("invalid Windows local file name: {name:?}"),
        ));
    }
    Ok(())
}

/// 验证用户选择的本地基目录是非空绝对路径。
pub(crate) fn validate_local_base_directory(parent: &Path) -> io::Result<()> {
    let text = parent.as_os_str().to_string_lossy();
    if text.trim().is_empty() || !parent.is_absolute() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("local base directory must be an absolute path: {parent:?}"),
        ));
    }
    Ok(())
}

/// 拒绝已存在的符号链接或目录联接；不存在的目标允许后续安全创建。
pub(crate) fn reject_existing_local_link(path: &Path) -> io::Result<()> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if is_link_or_reparse_point(&metadata) => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("local download path cannot be a symbolic link or junction: {path:?}"),
        )),
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

#[cfg(windows)]
fn is_link_or_reparse_point(metadata: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_link_or_reparse_point(metadata: &std::fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

/// 在父目录下安全构造一个单层本地子路径。
pub(crate) fn safe_local_child(parent: &Path, name: &str) -> io::Result<PathBuf> {
    validate_local_base_directory(parent)?;
    validate_local_file_name(name)?;
    let child = parent.join(name);
    reject_existing_local_link(&child)?;
    Ok(child)
}

/// 同目录临时文件的清理 guard。
///
/// guard 保持 armed 时，离开作用域会尽力删除临时文件；成功提交后调用 [`Self::disarm`]。
pub(crate) struct TempSiblingGuard {
    path: PathBuf,
    armed: bool,
}

impl TempSiblingGuard {
    /// 返回临时文件路径。
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }

    /// 解除自动删除，用于成功提交后的所有权转移。
    pub(crate) fn disarm(&mut self) {
        self.armed = false;
    }
}

impl Drop for TempSiblingGuard {
    fn drop(&mut self) {
        if self.armed {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

/// 在目标同目录以 `create_new` 创建 UUID `.part` 异步临时文件。
pub(crate) async fn create_async_temp_sibling(
    target: &Path,
) -> io::Result<(tokio::fs::File, TempSiblingGuard)> {
    let parent = target_parent(target);
    tokio::fs::create_dir_all(parent).await?;
    let stable_parent = tokio::fs::canonicalize(parent).await?;
    let file_name = target.file_name().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("download target must have a file name: {target:?}"),
        )
    })?;
    let stable_target = stable_parent.join(file_name);

    loop {
        let temp_path = temp_sibling_path(&stable_target);
        match tokio::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .await
        {
            Ok(file) => {
                return Ok((
                    file,
                    TempSiblingGuard {
                        path: temp_path,
                        armed: true,
                    },
                ));
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
}

/// 将异步下载内容写入同目录临时文件，并在提交时原子替换目标。
///
/// 文件字段先于 guard 声明，确保取消或错误离开作用域时先关闭文件，再同步清理临时文件。
pub(crate) struct AtomicDownloadFile {
    file: Option<tokio::fs::File>,
    guard: TempSiblingGuard,
    target: PathBuf,
}

impl AtomicDownloadFile {
    /// 创建与目标同目录的异步临时下载文件。
    pub(crate) async fn create(target: &Path) -> io::Result<Self> {
        let (file, guard) = create_async_temp_sibling(target).await?;
        let file_name = target.file_name().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("download target must have a file name: {target:?}"),
            )
        })?;
        let stable_target = guard
            .path()
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(file_name);
        Ok(Self {
            file: Some(file),
            guard,
            target: stable_target,
        })
    }

    /// 返回可写临时文件。
    pub(crate) fn file_mut(&mut self) -> io::Result<&mut tokio::fs::File> {
        self.file
            .as_mut()
            .ok_or_else(|| io::Error::other("atomic download file is already closed"))
    }

    #[cfg(test)]
    fn temp_path(&self) -> &Path {
        self.guard.path()
    }

    /// 刷新并同步临时文件，取消仍会由 guard 清理。
    pub(crate) async fn prepare(&mut self) -> io::Result<()> {
        use tokio::io::AsyncWriteExt;

        let file = self.file_mut()?;
        file.flush().await?;
        file.sync_all().await
    }

    /// 关闭临时文件句柄后同步原子替换目标；此方法不包含 await 点。
    pub(crate) fn commit(mut self) -> io::Result<()> {
        let file = self
            .file
            .take()
            .ok_or_else(|| io::Error::other("atomic download file is already closed"))?;
        drop(file);
        std::fs::rename(self.guard.path(), &self.target)?;
        self.guard.disarm();
        Ok(())
    }
}

/// 可靠发送最终进度，并在提交前预留终态事件容量。
///
/// receiver 已关闭时返回 `None`，调用方仍可提交下载。
pub(crate) async fn reserve_after_final_event<'a, T: Send>(
    progress: &'a tokio::sync::mpsc::Sender<T>,
    final_event: T,
) -> Option<tokio::sync::mpsc::Permit<'a, T>> {
    if progress.send(final_event).await.is_err() {
        return None;
    }
    progress.reserve().await.ok()
}

/// 将内容通过同目录临时文件同步原子写入目标路径。
pub(crate) fn atomic_write(target: &Path, content: &[u8]) -> io::Result<()> {
    let parent = target_parent(target);
    std::fs::create_dir_all(parent)?;

    loop {
        let temp_path = temp_sibling_path(target);
        let mut file = match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        };
        let mut guard = TempSiblingGuard {
            path: temp_path,
            armed: true,
        };

        file.write_all(content)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(guard.path(), target)?;
        guard.disarm();
        return Ok(());
    }
}

fn target_parent(target: &Path) -> &Path {
    target
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."))
}

fn temp_sibling_path(target: &Path) -> PathBuf {
    target.with_file_name(format!(".{}.part", Uuid::new_v4()))
}

fn is_windows_device_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or_default();
    let upper = stem.to_ascii_uppercase();
    matches!(
        upper.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || has_numbered_device_suffix(&upper, "COM")
        || has_numbered_device_suffix(&upper, "LPT")
}

fn has_numbered_device_suffix(name: &str, prefix: &str) -> bool {
    name.strip_prefix(prefix).is_some_and(|suffix| {
        matches!(
            suffix,
            "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
        )
    })
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use tokio::io::AsyncWriteExt;
    use uuid::Uuid;

    use crate::transport::ProgressEvent;

    use super::{
        atomic_write, create_async_temp_sibling, reserve_after_final_event, safe_local_child,
        validate_local_file_name, AtomicDownloadFile,
    };

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("sy-tfm-local-fs-{}", Uuid::new_v4()));
            std::fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn validates_windows_local_file_names() {
        for valid in [
            "file.txt",
            "中文.txt",
            "emoji-😀.txt",
            ".gitignore",
            "COM10",
            "LPT10.log",
            "conifer",
        ] {
            assert!(
                validate_local_file_name(valid).is_ok(),
                "expected valid name: {valid:?}"
            );
        }

        let too_long = "😀".repeat(128);
        for invalid in [
            "",
            ".",
            "..",
            "a/b",
            "a\\b",
            "C:\\file.txt",
            "\\\\server\\share",
            "/rooted",
            "two/components",
            "control\u{0}",
            "delete\u{7f}",
            "less<than",
            "greater>than",
            "colon:name",
            "quote\"name",
            "pipe|name",
            "question?name",
            "star*name",
            "trailing ",
            "trailing.",
            "CON",
            "con.txt",
            "PRN.log",
            "AUX",
            "NUL.data",
            "COM1",
            "com9.txt",
            "COM¹",
            "com².txt",
            "COM³.log",
            "LPT1",
            "lpt9.ext",
            "LPT¹",
            "lpt².txt",
            "LPT³.log",
            "CONIN$",
            "conout$.txt",
            too_long.as_str(),
        ] {
            assert!(
                validate_local_file_name(invalid).is_err(),
                "expected invalid name: {invalid:?}"
            );
        }
    }

    #[test]
    fn safe_child_stays_directly_beneath_parent() {
        let parent = std::env::temp_dir().join("downloads");
        assert_eq!(
            safe_local_child(&parent, "报告.txt").expect("valid child"),
            parent.join("报告.txt")
        );
        assert!(safe_local_child(&parent, "..\\escape.txt").is_err());
        assert!(safe_local_child(&parent, "nested/file.txt").is_err());
        assert!(safe_local_child(Path::new(""), "file.txt").is_err());
        assert!(safe_local_child(Path::new("relative"), "file.txt").is_err());
    }

    #[tokio::test]
    async fn temp_sibling_guard_removes_armed_file_on_drop() {
        let dir = TestDir::new();
        let target = dir.path().join("target.bin");
        let temp_path = {
            let (file, guard) = create_async_temp_sibling(&target)
                .await
                .expect("create temp sibling");
            let path = guard.path().to_path_buf();
            assert_eq!(
                std::fs::canonicalize(path.parent().unwrap()).expect("canonical temp parent"),
                std::fs::canonicalize(target.parent().unwrap()).expect("canonical target parent")
            );
            assert!(path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .ends_with(".part"));
            assert!(path.exists());
            drop(file);
            path
        };
        assert!(!temp_path.exists());
    }

    #[tokio::test]
    async fn disarmed_temp_sibling_guard_preserves_file() {
        let dir = TestDir::new();
        let target = dir.path().join("target.bin");
        let (file, mut guard) = create_async_temp_sibling(&target)
            .await
            .expect("create temp sibling");
        let temp_path = guard.path().to_path_buf();
        drop(file);
        guard.disarm();
        drop(guard);
        assert!(temp_path.exists());
    }

    #[tokio::test]
    async fn atomic_download_drop_preserves_old_target_and_cleans_part_file() {
        let dir = TestDir::new();
        let target = dir.path().join("download.bin");
        std::fs::write(&target, b"old").expect("write old target");

        let temp_path = {
            let mut download = AtomicDownloadFile::create(&target)
                .await
                .expect("create atomic download");
            download
                .file_mut()
                .expect("atomic download file should remain open")
                .write_all(b"partial")
                .await
                .expect("write partial temp content");
            let temp_path = download.temp_path().to_path_buf();
            assert!(temp_path.exists());
            temp_path
        };

        assert_eq!(std::fs::read(&target).expect("read old target"), b"old");
        assert!(!temp_path.exists());
    }

    #[tokio::test]
    async fn atomic_download_commit_replaces_target_and_cleans_part_file() {
        let dir = TestDir::new();
        let target = dir.path().join("download.bin");
        std::fs::write(&target, b"old").expect("write old target");

        let mut download = AtomicDownloadFile::create(&target)
            .await
            .expect("create atomic download");
        download
            .file_mut()
            .expect("atomic download file should remain open")
            .write_all(b"new")
            .await
            .expect("write new temp content");
        let temp_path = download.temp_path().to_path_buf();
        download.prepare().await.expect("prepare atomic download");
        download.commit().expect("commit atomic download");

        assert_eq!(std::fs::read(&target).expect("read new target"), b"new");
        assert!(!temp_path.exists());
    }

    #[tokio::test]
    async fn atomic_download_rename_failure_preserves_target_and_cleans_part_file() {
        let dir = TestDir::new();
        let target = dir.path().join("existing-target");
        std::fs::create_dir(&target).expect("create target directory");
        std::fs::write(target.join("sentinel"), b"old").expect("write sentinel");

        let mut download = AtomicDownloadFile::create(&target)
            .await
            .expect("create atomic download");
        download
            .file_mut()
            .expect("atomic download file should remain open")
            .write_all(b"replacement")
            .await
            .expect("write replacement temp content");
        let temp_path = download.temp_path().to_path_buf();

        download.prepare().await.expect("prepare atomic download");
        assert!(download.commit().is_err());
        assert!(target.is_dir());
        assert_eq!(
            std::fs::read(target.join("sentinel")).expect("read sentinel"),
            b"old"
        );
        assert!(!temp_path.exists());
    }

    #[tokio::test]
    async fn completion_is_observed_only_after_atomic_commit() {
        let dir = TestDir::new();
        let target = dir.path().join("download.bin");
        let mut done = false;

        let mut download = AtomicDownloadFile::create(&target)
            .await
            .expect("create atomic download");
        download
            .file_mut()
            .expect("atomic download file should remain open")
            .write_all(b"new")
            .await
            .expect("write new temp content");
        assert!(!done);

        download.prepare().await.expect("prepare atomic download");
        download.commit().expect("commit atomic download");
        done = true;

        assert!(done);
        assert_eq!(std::fs::read(&target).expect("read target"), b"new");
    }

    #[tokio::test]
    async fn final_event_and_done_reservation_survive_a_full_bounded_channel() {
        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
        tx.send("earlier").await.expect("fill progress channel");

        let receiver = tokio::spawn(async move {
            assert_eq!(rx.recv().await, Some("earlier"));
            assert_eq!(rx.recv().await, Some("final"));
            assert_eq!(rx.recv().await, Some("done"));
        });
        let permit = reserve_after_final_event(&tx, "final")
            .await
            .expect("receiver remains open");
        permit.send("done");
        drop(tx);

        receiver.await.expect("receiver task");
    }

    #[tokio::test]
    async fn zero_byte_download_queues_final_file_progress_before_done() {
        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
        let receiver = tokio::spawn(async move {
            match rx.recv().await {
                Some(ProgressEvent::Progress {
                    transferred,
                    total,
                    current_file,
                }) => {
                    assert_eq!(transferred, 0);
                    assert_eq!(total, 0);
                    assert_eq!(current_file, "/empty.txt");
                }
                event => panic!("expected final file progress, got {event:?}"),
            }
            assert!(matches!(rx.recv().await, Some(ProgressEvent::Done)));
        });

        let permit = reserve_after_final_event(
            &tx,
            ProgressEvent::Progress {
                transferred: 0,
                total: 0,
                current_file: "/empty.txt".to_string(),
            },
        )
        .await
        .expect("reserve done event");
        permit.send(ProgressEvent::Done);
        drop(tx);
        receiver.await.expect("receiver task");
    }

    #[tokio::test]
    async fn closed_progress_receiver_does_not_prevent_commit() {
        let dir = TestDir::new();
        let target = dir.path().join("download.bin");
        let (tx, rx) = tokio::sync::mpsc::channel::<&str>(1);
        drop(rx);

        let mut download = AtomicDownloadFile::create(&target)
            .await
            .expect("create atomic download");
        download
            .file_mut()
            .expect("atomic download file should remain open")
            .write_all(b"new")
            .await
            .expect("write content");
        let permit = reserve_after_final_event(&tx, "final").await;
        download.prepare().await.expect("prepare atomic download");
        download.commit().expect("commit without progress receiver");
        assert!(permit.is_none());
        assert_eq!(std::fs::read(&target).expect("read target"), b"new");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn atomic_download_uses_canonical_parent_after_symlink_is_redirected() {
        use std::os::unix::fs::symlink;

        let dir = TestDir::new();
        let original = dir.path().join("original");
        let redirected = dir.path().join("redirected");
        let link = dir.path().join("download-link");
        std::fs::create_dir(&original).expect("create original directory");
        std::fs::create_dir(&redirected).expect("create redirected directory");
        symlink(&original, &link).expect("create directory symlink");

        let target = link.join("download.bin");
        let mut download = AtomicDownloadFile::create(&target)
            .await
            .expect("create atomic download through symlink");
        download
            .file_mut()
            .expect("atomic download file should remain open")
            .write_all(b"new")
            .await
            .expect("write new content");
        std::fs::remove_file(&link).expect("remove original symlink");
        symlink(&redirected, &link).expect("redirect directory symlink");

        download.prepare().await.expect("prepare atomic download");
        download.commit().expect("commit through stable parent");

        assert_eq!(
            std::fs::read(original.join("download.bin")).expect("read original target"),
            b"new"
        );
        assert!(!redirected.join("download.bin").exists());
    }

    #[test]
    fn atomic_write_rename_failure_preserves_target_and_cleans_part_file() {
        let dir = TestDir::new();
        let target = dir.path().join("existing-target");
        std::fs::create_dir(&target).expect("create target directory");
        std::fs::write(target.join("sentinel"), b"old").expect("write sentinel");

        assert!(atomic_write(&target, b"replacement").is_err());
        assert!(target.is_dir());
        assert_eq!(
            std::fs::read(target.join("sentinel")).expect("read sentinel"),
            b"old"
        );
        assert_eq!(
            std::fs::read_dir(dir.path())
                .expect("read test directory")
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().ends_with(".part"))
                .count(),
            0
        );
    }

    #[test]
    fn atomic_write_creates_and_replaces_without_part_files() {
        let dir = TestDir::new();
        let target = dir.path().join("nested").join("settings.json");

        atomic_write(&target, b"first").expect("create target");
        assert_eq!(std::fs::read(&target).expect("read target"), b"first");

        atomic_write(&target, b"second").expect("replace target");
        assert_eq!(std::fs::read(&target).expect("read target"), b"second");

        let entries = std::fs::read_dir(target.parent().unwrap())
            .expect("read target directory")
            .map(|entry| entry.expect("read entry").path())
            .collect::<Vec<_>>();
        assert_eq!(entries, vec![target]);
    }
}
