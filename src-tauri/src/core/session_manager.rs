use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{RemoteFile, RemoteHost};
use crate::transport::FileTransport;

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

    /// 连接主机（Phase 1 任务 1.4 实现）。
    pub async fn connect(
        &self,
        _host: &RemoteHost,
        _password: Option<&str>,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("SessionManager.connect 尚未实现（Phase 1）"))
    }

    /// 断开指定主机的连接。
    pub async fn disconnect(&self, host_id: Uuid) -> Result<(), AppError> {
        let mut sessions = self.sessions.write().await;
        if let Some(mut session) = sessions.remove(&host_id) {
            session.transport.disconnect().await?;
        }
        Ok(())
    }

    /// 列出目录（Phase 1 任务 1.10 实现）。
    pub async fn list_directory(
        &self,
        _host_id: Uuid,
        _path: &str,
    ) -> Result<Vec<RemoteFile>, AppError> {
        Err(AppError::unsupported(
            "SessionManager.list_directory 尚未实现（Phase 1）",
        ))
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}
