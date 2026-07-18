//! 全局枚举目录（唯一真理源）。
//!
//! 所有常量、状态码、类型标识符必须在此目录定义为枚举，禁止魔法字符串。
//! 枚举经 `ts-rs` 自动生成 TypeScript 类型到 `src/types/enums/`。

pub mod adapter_capability;
pub(crate) mod app_directory;
pub(crate) mod app_event;
pub(crate) mod connection_policy;
pub mod connection_status;
pub mod edit_mode;
pub(crate) mod edit_policy;
pub mod error_code;
pub mod file_operation;
pub mod http_scheme;
pub mod language;
pub mod platform;
pub mod protocol;
pub mod sort_column;
pub mod sort_order;
pub mod theme;
pub mod transfer_direction;
pub(crate) mod transfer_policy;
pub(crate) mod webdav_depth;

pub use adapter_capability::AdapterCapability;
pub use connection_status::ConnectionStatus;
pub use edit_mode::EditMode;
pub use error_code::ErrorCode;
pub use file_operation::FileOperation;
pub use http_scheme::HttpScheme;
pub use language::Language;
pub use platform::Platform;
pub use protocol::Protocol;
pub use sort_column::SortColumn;
pub use sort_order::SortOrder;
pub use theme::Theme;
pub use transfer_direction::TransferDirection;
