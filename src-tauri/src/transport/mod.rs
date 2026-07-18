//! 文件传输协议抽象层。
//!
//! [`FileTransport`] trait 是所有协议交互的唯一接口（AGENTS.md §2.1 ARCH-01）。
//! 上层代码（SessionManager、Commands、UI）仅依赖此 trait，不感知具体协议实现。

pub mod sftp_adapter;
pub mod webdav_adapter;

pub use sftp_adapter::SftpAdapter;
pub use webdav_adapter::WebDavAdapter;

use async_trait::async_trait;
use serde::Serialize;

use crate::enums::{AdapterCapability, Protocol};
use crate::error::AppError;
use crate::models::{RemoteFile, RemoteHost};

/// 内部进度事件（通过 mpsc channel 传递给命令层）。
#[derive(Debug, Clone, Serialize)]
pub enum ProgressEvent {
    /// 进度更新
    Progress {
        /// 已传输字节数
        transferred: u64,
        /// 总字节数
        total: u64,
        /// 当前文件名
        current_file: String,
    },
    /// 传输完成
    Done,
    /// 传输错误
    Error(String),
}

/// 进度回调通道。
pub type ProgressTx = tokio::sync::mpsc::Sender<ProgressEvent>;

/// 文件传输协议抽象层。
///
/// 所有协议 adapter 必须实现此 trait。
/// 上层代码（SessionManager、Commands）仅依赖此 trait，不感知具体协议实现。
#[async_trait]
pub trait FileTransport: Send + Sync {
    /// 返回协议类型。
    fn protocol(&self) -> Protocol;

    /// 返回 adapter 支持的能力。
    fn capabilities(&self) -> AdapterCapability;

    /// 连接远程主机。
    async fn connect(&mut self, host: &RemoteHost, password: Option<&str>) -> Result<(), AppError>;

    /// 断开连接。
    async fn disconnect(&self) -> Result<(), AppError>;

    /// 列出目录内容。
    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError>;

    /// 下载文件（支持进度回调）。
    async fn download_file(
        &self,
        remote_path: &str,
        local_path: &str,
        progress: ProgressTx,
    ) -> Result<(), AppError>;

    /// 上传文件（支持进度回调）。
    async fn upload_file(
        &self,
        local_path: &str,
        remote_path: &str,
        progress: ProgressTx,
    ) -> Result<(), AppError>;

    /// 删除文件。
    async fn delete_file(&self, path: &str) -> Result<(), AppError>;

    /// 删除目录（递归）。
    async fn delete_directory(&self, path: &str) -> Result<(), AppError>;

    /// 创建目录。
    async fn create_directory(&self, path: &str) -> Result<(), AppError>;

    /// 移动/重命名文件或目录。
    async fn move_file(&self, from: &str, to: &str) -> Result<(), AppError>;

    /// 获取当前工作目录。
    async fn get_working_dir(&self) -> Result<String, AppError>;

    /// 切换工作目录。
    async fn change_dir(&mut self, path: &str) -> Result<(), AppError>;

    /// 检查连接是否活跃。
    async fn is_connected(&self) -> bool;
}

/// Adapter 工厂：根据协议创建对应 adapter。
///
/// 新增协议的标准步骤（零修改上层代码）：
/// 1. 在 `transport/` 新建 `xxx_adapter.rs` 并实现 [`FileTransport`]；
/// 2. 在 [`Protocol`] 枚举添加变体；
/// 3. 在此工厂函数注册。
pub fn create_adapter(protocol: Protocol) -> Box<dyn FileTransport> {
    match protocol {
        Protocol::Sftp => Box::new(SftpAdapter::new()),
        Protocol::WebDav => Box::new(WebDavAdapter::new()),
        // 后续迭代：
        // Protocol::Ftp => Box::new(FtpAdapter::new()),
        // Protocol::S3 => Box::new(S3Adapter::new()),
        // Protocol::Scp => Box::new(ScpAdapter::new()),
        _ => panic!("Unsupported protocol: {protocol:?}"),
    }
}
