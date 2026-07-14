use async_trait::async_trait;

use crate::enums::{AdapterCapability, Protocol};
use crate::error::AppError;
use crate::models::{RemoteFile, RemoteHost};
use crate::transport::{FileTransport, ProgressTx};

/// SFTP adapter（russh）骨架。
///
/// 完整实现见 Phase 1 任务 1.1。
pub struct SftpAdapter;

impl SftpAdapter {
    /// 创建新实例。
    pub fn new() -> Self {
        Self
    }
}

impl Default for SftpAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl FileTransport for SftpAdapter {
    fn protocol(&self) -> Protocol {
        Protocol::Sftp
    }

    fn capabilities(&self) -> AdapterCapability {
        AdapterCapability::OWNER_PERMISSIONS
            | AdapterCapability::SYMLINKS
            | AdapterCapability::ATOMIC_RENAME
    }

    async fn connect(
        &mut self,
        _host: &RemoteHost,
        _password: Option<&str>,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn disconnect(&mut self) -> Result<(), AppError> {
        Ok(())
    }

    async fn list_directory(&self, _path: &str) -> Result<Vec<RemoteFile>, AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn download_file(
        &self,
        _remote_path: &str,
        _local_path: &str,
        _progress: ProgressTx,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn upload_file(
        &self,
        _local_path: &str,
        _remote_path: &str,
        _progress: ProgressTx,
    ) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn delete_file(&self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn delete_directory(&self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn create_directory(&self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn move_file(&self, _from: &str, _to: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn get_working_dir(&self) -> Result<String, AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn change_dir(&mut self, _path: &str) -> Result<(), AppError> {
        Err(AppError::unsupported("SftpAdapter 尚未实现（Phase 1 任务 1.1）"))
    }

    async fn is_connected(&self) -> bool {
        false
    }
}
