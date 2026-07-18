//! 会话管理器：维护所有活跃连接，通过 `Box<dyn FileTransport>` trait 对象调度。
//!
//! 上层命令仅依赖此管理器，不感知具体协议实现（AGENTS.md §2.1 ARCH-01）。

use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::crypto::key_storage;
use crate::crypto::secret_protector::SecretProtector;
use crate::enums::connection_policy::ConnectionPolicy;
use crate::enums::transfer_policy::TransferPolicy;
use crate::enums::{AdapterCapability, ErrorCode, Protocol};
use crate::error::AppError;
use crate::models::{RemoteFile, RemoteHost};
use crate::transport::{create_adapter, FileTransport, ProgressTx};

/// 单个主机的连接会话（仅内存，不序列化）。
pub struct Session {
    /// 主机 ID
    pub host_id: Uuid,
    /// 主机配置
    pub host: RemoteHost,
    /// 协议 adapter（trait 对象）
    pub transport: Box<dyn FileTransport>,
    /// 当前路径
    pub current_path: RwLock<String>,
    /// 创建时间
    pub created_at: Instant,
}

impl Session {
    /// 协议
    pub fn protocol(&self) -> Protocol {
        self.transport.protocol()
    }

    /// 能力
    pub fn capabilities(&self) -> AdapterCapability {
        self.transport.capabilities()
    }
}

/// 会话管理器：维护所有活跃连接，通过 `Box<dyn FileTransport>` trait 对象调度。
///
/// 上层命令仅依赖此管理器，不感知具体协议实现（AGENTS.md §2.1）。
#[derive(Clone)]
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<Uuid, Arc<Session>>>>,
}

impl SessionManager {
    /// 创建空的会话管理器。
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 连接主机。
    ///
    /// 1. 解密密码（如有 `enc.v1:` 前缀）；
    /// 2. 创建 adapter 并连接；
    /// 3. 存入会话表。
    pub async fn connect(
        &self,
        host: &RemoteHost,
        password_override: Option<&str>,
    ) -> Result<(String, Protocol, AdapterCapability), AppError> {
        // 如果已连接，先断开
        {
            let sessions = self.sessions.read().await;
            if sessions.contains_key(&host.id) {
                return Err(AppError::new(
                    crate::enums::ErrorCode::FileAlreadyExists,
                    "该主机已连接，请先断开",
                ));
            }
        }

        // 解析密码：优先用 override，其次解密 host.password，最后空
        let password = resolve_password(host, password_override)?;

        // 创建 adapter 并连接
        let mut transport = create_adapter(host.protocol);
        tokio::time::timeout(
            Duration::from_secs(TransferPolicy::ConnectTimeoutSeconds.value()),
            transport.connect(host, password.as_deref()),
        )
        .await
        .map_err(|_| {
            AppError::new(
                ErrorCode::ConnectionTimeout,
                format!("连接 {} 超时", host.name),
            )
        })?
        .map_err(|e| wrap_connect_error(host, e))?;

        let home_dir = tokio::time::timeout(
            Duration::from_secs(TransferPolicy::ReadTimeoutSeconds.value()),
            transport.get_working_dir(),
        )
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_else(|| "/".to_string());
        let protocol = transport.protocol();
        let capabilities = transport.capabilities();

        let session = Arc::new(Session {
            host_id: host.id,
            host: host.clone(),
            transport,
            current_path: RwLock::new(home_dir.clone()),
            created_at: Instant::now(),
        });

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(host.id, session);
        }

        Ok((home_dir, protocol, capabilities))
    }

    /// 断开指定主机的连接。
    pub async fn disconnect(&self, host_id: Uuid) -> Result<(), AppError> {
        let session = self.sessions.write().await.remove(&host_id);
        if let Some(session) = session {
            let _ = session.transport.disconnect().await;
        }
        Ok(())
    }

    /// 获取会话（只读引用），执行闭包。
    async fn with_session<R>(
        &self,
        host_id: Uuid,
        f: impl AsyncFnOnce(&Session) -> R,
    ) -> Result<R, AppError> {
        let session = self
            .sessions
            .read()
            .await
            .get(&host_id)
            .cloned()
            .ok_or_else(|| AppError::session_not_found(host_id))?;
        Ok(f(&session).await)
    }

    /// 列出目录。
    pub async fn list_directory(
        &self,
        host_id: Uuid,
        path: &str,
    ) -> Result<Vec<RemoteFile>, AppError> {
        run_remote_operation(self.with_session(host_id, async move |s| {
            s.transport.list_directory(path).await
        }))
        .await?
    }

    /// 下载文件。
    pub async fn download_file(
        &self,
        host_id: Uuid,
        remote_path: &str,
        local_path: &str,
        progress: ProgressTx,
    ) -> Result<(), AppError> {
        self.with_session(host_id, async move |s| {
            s.transport
                .download_file(remote_path, local_path, progress)
                .await
        })
        .await?
    }

    /// 上传文件。
    pub async fn upload_file(
        &self,
        host_id: Uuid,
        local_path: &str,
        remote_path: &str,
        progress: ProgressTx,
    ) -> Result<(), AppError> {
        self.with_session(host_id, async move |s| {
            s.transport
                .upload_file(local_path, remote_path, progress)
                .await
        })
        .await?
    }

    /// 上传内存内容（写临时文件再调 upload_file）。
    pub async fn upload_content(
        &self,
        host_id: Uuid,
        remote_path: &str,
        content: Vec<u8>,
        progress: ProgressTx,
    ) -> Result<(), AppError> {
        let tmp = std::env::temp_dir().join(format!("sy-tfm-upload-{}", Uuid::new_v4()));
        tokio::fs::write(&tmp, &content).await?;
        let local_path = tmp.to_string_lossy().into_owned();
        let result = self
            .upload_file(host_id, &local_path, remote_path, progress)
            .await;
        let _ = tokio::fs::remove_file(&tmp).await;
        result
    }

    /// 删除文件。
    pub async fn delete_file(&self, host_id: Uuid, path: &str) -> Result<(), AppError> {
        run_remote_operation(
            self.with_session(host_id, async move |s| s.transport.delete_file(path).await),
        )
        .await?
    }

    /// 删除目录。
    pub async fn delete_directory(&self, host_id: Uuid, path: &str) -> Result<(), AppError> {
        run_remote_operation(self.with_session(host_id, async move |s| {
            s.transport.delete_directory(path).await
        }))
        .await?
    }

    /// 创建目录。
    pub async fn create_directory(&self, host_id: Uuid, path: &str) -> Result<(), AppError> {
        run_remote_operation(self.with_session(host_id, async move |s| {
            s.transport.create_directory(path).await
        }))
        .await?
    }

    /// 移动/重命名。
    pub async fn move_file(&self, host_id: Uuid, from: &str, to: &str) -> Result<(), AppError> {
        run_remote_operation(self.with_session(host_id, async move |s| {
            s.transport.move_file(from, to).await
        }))
        .await?
    }

    /// 获取当前工作目录。
    pub async fn get_working_dir(&self, host_id: Uuid) -> Result<String, AppError> {
        self.with_session(host_id, async move |s| s.current_path.read().await.clone())
            .await
    }

    /// 切换工作目录。
    pub async fn change_dir(&self, host_id: Uuid, path: &str) -> Result<String, AppError> {
        let new_path = path.to_string();
        run_remote_operation(self.with_session(host_id, async move |s| {
            s.transport.list_directory(path).await?;
            *s.current_path.write().await = new_path.clone();
            Ok::<String, AppError>(new_path)
        }))
        .await?
    }

    /// 导航到路径（切换目录 + 列出内容，原子操作）。
    pub async fn navigate(
        &self,
        host_id: Uuid,
        path: &str,
    ) -> Result<(String, Vec<RemoteFile>), AppError> {
        let current_path = path.to_string();
        run_remote_operation(self.with_session(host_id, async move |s| {
            let files = s.transport.list_directory(path).await?;
            *s.current_path.write().await = current_path.clone();
            Ok::<(String, Vec<RemoteFile>), AppError>((current_path, files))
        }))
        .await?
    }

    /// 检查是否已连接。
    pub async fn is_connected(&self, host_id: Uuid) -> bool {
        loop {
            let Some(session) = self.sessions.read().await.get(&host_id).cloned() else {
                return false;
            };
            if session.transport.is_connected().await {
                return true;
            }
            if self.remove_if_current(host_id, &session).await {
                return false;
            }
            // 探测期间会话已被新连接替换；重新检查新会话，绝不让旧结果误删新连接。
        }
    }

    /// 监控当前这一代会话；真实连接失效并被清理时返回 `true`。
    ///
    /// 显式断开或同一主机建立了新一代会话时返回 `false`，避免旧监控任务
    /// 覆盖新连接的前端状态。
    pub async fn monitor_connection(&self, host_id: Uuid) -> bool {
        let Some(monitored) = self.sessions.read().await.get(&host_id).cloned() else {
            return false;
        };
        let interval = Duration::from_secs(ConnectionPolicy::HealthCheckIntervalSeconds.value());
        loop {
            tokio::time::sleep(interval).await;
            if !self.is_current(host_id, &monitored).await {
                return false;
            }
            if !monitored.transport.is_connected().await {
                return self.remove_if_current(host_id, &monitored).await;
            }
        }
    }

    /// 获取 adapter 能力。
    pub async fn get_capabilities(&self, host_id: Uuid) -> Result<AdapterCapability, AppError> {
        self.with_session(host_id, async move |s| s.capabilities())
            .await
    }

    /// 获取协议。
    pub async fn get_protocol(&self, host_id: Uuid) -> Result<Protocol, AppError> {
        self.with_session(host_id, async move |s| s.protocol())
            .await
    }

    /// 获取当前路径。
    pub async fn get_current_path(&self, host_id: Uuid) -> Result<String, AppError> {
        self.with_session(host_id, async move |s| s.current_path.read().await.clone())
            .await
    }

    /// 获取会话创建时间。
    pub async fn get_session_age(&self, host_id: Uuid) -> Result<Option<u64>, AppError> {
        self.with_session(host_id, async move |s| s.created_at.elapsed().as_secs())
            .await
            .map(Some)
    }

    /// 获取所有已连接主机 ID。
    pub async fn connected_host_ids(&self) -> Vec<Uuid> {
        let candidates = self
            .sessions
            .read()
            .await
            .keys()
            .copied()
            .collect::<Vec<_>>();
        let mut connected = Vec::with_capacity(candidates.len());
        for host_id in candidates {
            if self.is_connected(host_id).await {
                connected.push(host_id);
            }
        }
        connected
    }

    /// 获取所有已连接主机信息。
    pub async fn connected_hosts(
        &self,
    ) -> Vec<(Uuid, String, Protocol, String, AdapterCapability)> {
        let host_ids = self.connected_host_ids().await;
        let mut connected = Vec::with_capacity(host_ids.len());
        for host_id in host_ids {
            if let Some(session) = self.sessions.read().await.get(&host_id).cloned() {
                connected.push((
                    session.host_id,
                    session.host.name.clone(),
                    session.protocol(),
                    session.current_path.read().await.clone(),
                    session.capabilities(),
                ));
            }
        }
        connected
    }

    /// 检查文件是否存在（通过 list 父目录判断）。
    pub async fn file_exists(&self, host_id: Uuid, path: &str) -> Result<bool, AppError> {
        let parent = path.rsplit_once('/').map(|(p, _)| p).unwrap_or("/");
        let name = path.rsplit_once('/').map(|(_, n)| n).unwrap_or(path);
        let entries = self.list_directory(host_id, parent).await?;
        Ok(entries.iter().any(|e| e.name == name))
    }

    async fn is_current(&self, host_id: Uuid, expected: &Arc<Session>) -> bool {
        self.sessions
            .read()
            .await
            .get(&host_id)
            .is_some_and(|current| Arc::ptr_eq(current, expected))
    }

    async fn remove_if_current(&self, host_id: Uuid, expected: &Arc<Session>) -> bool {
        let mut sessions = self.sessions.write().await;
        let matches = sessions
            .get(&host_id)
            .is_some_and(|current| Arc::ptr_eq(current, expected));
        if matches {
            sessions.remove(&host_id);
        }
        matches
    }
}

async fn run_remote_operation<T>(
    operation: impl Future<Output = Result<T, AppError>>,
) -> Result<T, AppError> {
    tokio::time::timeout(
        Duration::from_secs(TransferPolicy::ReadTimeoutSeconds.value()),
        operation,
    )
    .await
    .map_err(|_| {
        AppError::new(
            ErrorCode::OperationTimeout,
            "远程操作长时间没有响应，已自动停止",
        )
    })?
}

fn wrap_connect_error(host: &RemoteHost, error: AppError) -> AppError {
    AppError::new(
        error.code,
        format!(
            "连接 {}:{} 失败: {}",
            host.host,
            host.effective_port(),
            error.message
        ),
    )
    .with_optional_details(error.details)
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 解析密码：优先 override，其次解密 host.password，最后空。
fn resolve_password(
    host: &RemoteHost,
    override_pw: Option<&str>,
) -> Result<Option<String>, AppError> {
    if let Some(pw) = override_pw {
        if !pw.is_empty() {
            return Ok(Some(pw.to_string()));
        }
    }
    if host.password.is_empty() {
        return Ok(None);
    }
    // 加密密码：尝试解密
    if host
        .password
        .starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX)
    {
        let key = key_storage::get_or_create_master_key()?;
        let protector = SecretProtector::new(key);
        let decrypted = protector.decrypt(&host.password)?;
        return Ok(Some(decrypted));
    }
    // 明文密码（兼容旧配置）
    Ok(Some(host.password.clone()))
}

#[cfg(test)]
mod password_resolution_tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    use async_trait::async_trait;
    use tokio::sync::Notify;

    use crate::transport::ProgressTx;

    struct HealthTransport {
        alive: Arc<AtomicBool>,
        probe_started: Option<Arc<Notify>>,
        release_probe: Option<Arc<Notify>>,
    }

    #[async_trait]
    impl FileTransport for HealthTransport {
        fn protocol(&self) -> Protocol {
            Protocol::Sftp
        }

        fn capabilities(&self) -> AdapterCapability {
            AdapterCapability::NONE
        }

        async fn connect(
            &mut self,
            _host: &RemoteHost,
            _password: Option<&str>,
        ) -> Result<(), AppError> {
            Ok(())
        }

        async fn disconnect(&self) -> Result<(), AppError> {
            Ok(())
        }

        async fn list_directory(&self, _path: &str) -> Result<Vec<RemoteFile>, AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn download_file(
            &self,
            _remote_path: &str,
            _local_path: &str,
            _progress: ProgressTx,
        ) -> Result<(), AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn upload_file(
            &self,
            _local_path: &str,
            _remote_path: &str,
            _progress: ProgressTx,
        ) -> Result<(), AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn delete_file(&self, _path: &str) -> Result<(), AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn delete_directory(&self, _path: &str) -> Result<(), AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn create_directory(&self, _path: &str) -> Result<(), AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn move_file(&self, _from: &str, _to: &str) -> Result<(), AppError> {
            Err(AppError::unsupported("not used by connection health tests"))
        }

        async fn get_working_dir(&self) -> Result<String, AppError> {
            Ok("/".to_string())
        }

        async fn change_dir(&mut self, _path: &str) -> Result<(), AppError> {
            Ok(())
        }

        async fn is_connected(&self) -> bool {
            if let Some(probe_started) = &self.probe_started {
                probe_started.notify_one();
            }
            if let Some(release_probe) = &self.release_probe {
                release_probe.notified().await;
            }
            self.alive.load(Ordering::Acquire)
        }
    }

    fn host_with_password(password: &str) -> RemoteHost {
        RemoteHost {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            protocol: Protocol::Sftp,
            host: "example.test".to_string(),
            port: 22,
            username: "tester".to_string(),
            password: password.to_string(),
            tags: String::new(),
            download_path: None,
            https: true,
            base_path: None,
            sftp_host_key_fingerprint: None,
            is_connected: false,
        }
    }

    async fn insert_health_session(
        manager: &SessionManager,
        host: RemoteHost,
        transport: HealthTransport,
    ) -> Arc<Session> {
        let session = Arc::new(Session {
            host_id: host.id,
            host,
            transport: Box::new(transport),
            current_path: RwLock::new("/".to_string()),
            created_at: Instant::now(),
        });
        manager
            .sessions
            .write()
            .await
            .insert(session.host_id, Arc::clone(&session));
        session
    }

    #[test]
    fn temporary_password_override_is_forwarded_exactly() {
        let host = host_with_password("enc.v1:unreadable-old-secret");
        let password = resolve_password(&host, Some(" exact temporary secret "))
            .expect("override should not decrypt the saved value");

        assert_eq!(password.as_deref(), Some(" exact temporary secret "));
    }

    #[test]
    fn connect_error_wrapper_preserves_structured_details() {
        let host = host_with_password("");
        let details = serde_json::json!({
            "host": host.host,
            "port": 22,
            "actualFingerprint": "SHA256:actual"
        });
        let wrapped = wrap_connect_error(
            &host,
            AppError::new(ErrorCode::HostKeyUnknown, "unknown key").with_details(details.clone()),
        );
        assert_eq!(wrapped.code, ErrorCode::HostKeyUnknown);
        assert_eq!(wrapped.details, Some(details));
    }

    #[tokio::test]
    async fn connection_health_uses_the_adapter_and_removes_a_dead_session() {
        let manager = SessionManager::new();
        let host = host_with_password("");
        let host_id = host.id;
        let alive = Arc::new(AtomicBool::new(false));
        insert_health_session(
            &manager,
            host,
            HealthTransport {
                alive,
                probe_started: None,
                release_probe: None,
            },
        )
        .await;

        assert!(!manager.is_connected(host_id).await);
        assert!(!manager.sessions.read().await.contains_key(&host_id));
    }

    #[tokio::test]
    async fn a_late_dead_probe_cannot_remove_a_new_reconnected_session() {
        let manager = SessionManager::new();
        let host = host_with_password("");
        let host_id = host.id;
        let probe_started = Arc::new(Notify::new());
        let release_probe = Arc::new(Notify::new());
        insert_health_session(
            &manager,
            host.clone(),
            HealthTransport {
                alive: Arc::new(AtomicBool::new(false)),
                probe_started: Some(Arc::clone(&probe_started)),
                release_probe: Some(Arc::clone(&release_probe)),
            },
        )
        .await;

        let health_check = tokio::spawn({
            let manager = manager.clone();
            async move { manager.is_connected(host_id).await }
        });
        probe_started.notified().await;
        let replacement = insert_health_session(
            &manager,
            host,
            HealthTransport {
                alive: Arc::new(AtomicBool::new(true)),
                probe_started: None,
                release_probe: None,
            },
        )
        .await;
        release_probe.notify_one();

        assert!(health_check.await.expect("health check task should finish"));
        let current = manager
            .sessions
            .read()
            .await
            .get(&host_id)
            .cloned()
            .expect("replacement session should remain registered");
        assert!(Arc::ptr_eq(&current, &replacement));
    }
}
