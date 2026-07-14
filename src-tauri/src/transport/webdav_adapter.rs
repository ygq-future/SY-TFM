use async_trait::async_trait;

use crate::enums::{AdapterCapability, Protocol};
use crate::error::AppError;
use crate::models::{RemoteFile, RemoteHost};
use crate::transport::{FileTransport, ProgressTx};

/// WebDAV adapter（reqwest + quick-xml）骨架。
///
/// 完整实现见 Phase 1 任务 1.2。
pub struct WebDavAdapter;

impl WebDavAdapter {
    /// 创建新实例。
    pub fn new() -> Self {
        Self
    }
}

impl Default for WebDavAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl FileTransport for WebDavAdapter {
    fn protocol(&self) -> Protocol {
        Protocol::WebDav
    }

    fn capabilities(&self) -> AdapterCapability {
        // WebDAV 基础能力：无 owner/permissions
        AdapterCapability::NONE
    }

    async fn connect(
        &mut self,
        _host: &RemoteHost,
        _password: Option<&str>,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn disconnect(&mut self) -> Result<(), AppError> {
        Ok(())
    }

    async fn list_directory(&self, _path: &str) -> Result<Vec<RemoteFile>, AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn download_file(
        &self,
        _remote_path: &str,
        _local_path: &str,
        _progress: ProgressTx,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn upload_file(
        &self,
        _local_path: &str,
        _remote_path: &str,
        _progress: ProgressTx,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn delete_file(&self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn delete_directory(&self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn create_directory(&self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn move_file(&self, _from: &str, _to: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn get_working_dir(&self) -> Result<String, AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn change_dir(&mut self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("WebDavAdapter 尚未实现（Phase 1 任务 1.2）"))
    }

    async fn is_connected(&self) -> bool {
        false
    }
}
