//! 核心业务：会话管理、文件监听等。

pub mod file_watcher;
pub mod session_manager;
pub mod transfer_manager;

pub use file_watcher::EditSessionManager;
pub use session_manager::SessionManager;
pub use transfer_manager::TransferManager;
