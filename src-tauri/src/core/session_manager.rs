//! 会话管理器：维护所有活跃连接，通过 `Box<dyn FileTransport>` trait 对象调度。
//!
//! 上层命令仅依赖此管理器，不感知具体协议实现（AGENTS.md §2.1 ARCH-01）。

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::crypto::key_storage;
use crate::crypto::secret_protector::SecretProtector;
use crate::enums::{AdapterCapability, ConnectionStatus, Protocol};
use crate::error::AppError;
use crate::models::{RemoteFile, RemoteHost};
use crate::transport::{create_adapter, FileTransport, ProgressEvent};

/// 单个主机的连接会话（仅内存，不序列化）。
pub struct Session {
    /// 主机 ID
    pub host_id: Uuid,
    /// 主机配置
    pub host: RemoteHost,
    /// 协议 adapter（trait 对象）
    pub transport: Box<dyn FileTransport>,
    /// 当前路径
    pub current_path: String,
    /// 创建时间
    pub created_at: Instant,
}

impl Session {
    /// 连接状态。
    pub fn status(&self) -> ConnectionStatus {
        // 注：is_connected 是 async，此处同步返回近似值
        ConnectionStatus::Connected
    }

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
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<Uuid, Session>>>,
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
        transport
            .connect(host, password.as_deref())
            .await
            .map_err(|e| {
                AppError::connection_failed(format!(
                    "连接 {}:{} 失败: {}",
                    host.host,
                    host.effective_port(),
                    e.message
                ))
            })?;

        let home_dir = transport.get_working_dir().await.unwrap_or_else(|_| "/".to_string());
        let protocol = transport.protocol();
        let capabilities = transport.capabilities();

        let session = Session {
            host_id: host.id,
            host: host.clone(),
            transport,
            current_path: home_dir.clone(),
            created_at: Instant::now(),
        };

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(host.id, session);
        }

        Ok((home_dir, protocol, capabilities))
    }

    /// 断开指定主机的连接。
    pub async fn disconnect(&self, host_id: Uuid) -> Result<(), AppError> {
        let mut sessions = self.sessions.write().await;
        if let Some(mut session) = sessions.remove(&host_id) {
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
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(&host_id)
            .ok_or_else(|| AppError::session_not_found(host_id))?;
        Ok(f(session).await)
    }

    /// 获取会话（可变引用），执行闭包。
    async fn with_session_mut<R>(
        &self,
        host_id: Uuid,
        f: impl AsyncFnOnce(&mut Session) -> R,
    ) -> Result<R, AppError> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(&host_id)
            .ok_or_else(|| AppError::session_not_found(host_id))?;
        Ok(f(session).await)
    }

    /// 列出目录。
    pub async fn list_directory(
        &self,
        host_id: Uuid,
        path: &str,
    ) -> Result<Vec<RemoteFile>, AppError> {
        self.with_session(host_id, async move |s| s.transport.list_directory(path).await)
            .await?
    }

    /// 下载文件。
    pub async fn download_file(
        &self,
        host_id: Uuid,
        remote_path: &str,
        local_path: &str,
    ) -> Result<(), AppError> {
        let (tx, _rx) = tokio::sync::mpsc::channel::<ProgressEvent>(16);
        self.with_session(host_id, async move |s| {
            s.transport
                .download_file(remote_path, local_path, tx)
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
    ) -> Result<(), AppError> {
        let (tx, _rx) = tokio::sync::mpsc::channel::<ProgressEvent>(16);
        self.with_session(host_id, async move |s| {
            s.transport.upload_file(local_path, remote_path, tx).await
        })
        .await?
    }

    /// 上传内存内容（写临时文件再调 upload_file）。
    pub async fn upload_content(
        &self,
        host_id: Uuid,
        remote_path: &str,
        content: Vec<u8>,
    ) -> Result<(), AppError> {
        let tmp = std::env::temp_dir().join(format!("sy-tfm-upload-{}", Uuid::new_v4()));
        tokio::fs::write(&tmp, &content).await?;
        let result = self.upload_file(host_id, tmp.to_str().unwrap(), remote_path).await;
        let _ = tokio::fs::remove_file(&tmp).await;
        result
    }

    /// 删除文件。
    pub async fn delete_file(&self, host_id: Uuid, path: &str) -> Result<(), AppError> {
        self.with_session(host_id, async move |s| s.transport.delete_file(path).await)
            .await?
    }

    /// 删除目录。
    pub async fn delete_directory(&self, host_id: Uuid, path: &str) -> Result<(), AppError> {
        self.with_session(host_id, async move |s| s.transport.delete_directory(path).await)
            .await?
    }

    /// 创建目录。
    pub async fn create_directory(&self, host_id: Uuid, path: &str) -> Result<(), AppError> {
        self.with_session(host_id, async move |s| s.transport.create_directory(path).await)
            .await?
    }

    /// 移动/重命名。
    pub async fn move_file(
        &self,
        host_id: Uuid,
        from: &str,
        to: &str,
    ) -> Result<(), AppError> {
        self.with_session(host_id, async move |s| s.transport.move_file(from, to).await)
            .await?
    }

    /// 获取当前工作目录。
    pub async fn get_working_dir(&self, host_id: Uuid) -> Result<String, AppError> {
        self.with_session(host_id, async move |s| s.transport.get_working_dir().await)
            .await?
    }

    /// 切换工作目录。
    pub async fn change_dir(&self, host_id: Uuid, path: &str) -> Result<String, AppError> {
        let new_path = self
            .with_session_mut(host_id, async move |s| {
                s.transport.change_dir(path).await?;
                s.transport.get_working_dir().await
            })
            .await??;
        // 更新 current_path
        {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(&host_id) {
                session.current_path = new_path.clone();
            }
        }
        Ok(new_path)
    }

    /// 导航到路径（切换目录 + 列出内容，原子操作）。
    pub async fn navigate(
        &self,
        host_id: Uuid,
        path: &str,
    ) -> Result<(String, Vec<RemoteFile>), AppError> {
        let current_path = self.change_dir(host_id, path).await?;
        let files = self.list_directory(host_id, &current_path).await?;
        Ok((current_path, files))
    }

    /// 检查是否已连接。
    pub async fn is_connected(&self, host_id: Uuid) -> bool {
        let sessions = self.sessions.read().await;
        sessions.contains_key(&host_id)
    }

    /// 获取 adapter 能力。
    pub async fn get_capabilities(
        &self,
        host_id: Uuid,
    ) -> Result<AdapterCapability, AppError> {
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
        self.with_session(host_id, async move |s| s.current_path.clone())
            .await
    }

    /// 获取会话创建时间。
    pub async fn get_session_age(
        &self,
        host_id: Uuid,
    ) -> Result<Option<u64>, AppError> {
        self.with_session(host_id, async move |s| {
            s.created_at.elapsed().as_secs()
        })
        .await
        .map(Some)
    }

    /// 获取所有已连接主机 ID。
    pub async fn connected_host_ids(&self) -> Vec<Uuid> {
        let sessions = self.sessions.read().await;
        sessions.keys().copied().collect()
    }

    /// 获取所有已连接主机信息。
    pub async fn connected_hosts(&self) -> Vec<(Uuid, String, Protocol, String, AdapterCapability)> {
        let sessions = self.sessions.read().await;
        sessions
            .values()
            .map(|s| {
                (
                    s.host_id,
                    s.host.name.clone(),
                    s.protocol(),
                    s.current_path.clone(),
                    s.capabilities(),
                )
            })
            .collect()
    }

    /// 检查文件是否存在（通过 list 父目录判断）。
    pub async fn file_exists(&self, host_id: Uuid, path: &str) -> Result<bool, AppError> {
        let parent = path.rsplit_once('/').map(|(p, _)| p).unwrap_or("/");
        let name = path.rsplit_once('/').map(|(_, n)| n).unwrap_or(path);
        let entries = self.list_directory(host_id, parent).await?;
        Ok(entries.iter().any(|e| e.name == name))
    }
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
    if host.password.starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX) {
        let key = key_storage::get_or_create_master_key()?;
        let protector = SecretProtector::new(key);
        let decrypted = protector.decrypt(&host.password)?;
        return Ok(Some(decrypted));
    }
    // 明文密码（兼容旧配置）
    Ok(Some(host.password.clone()))
}
