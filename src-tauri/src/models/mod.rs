//! 数据模型：Rust 结构体定义，经 `ts-rs` 自动生成 TypeScript 类型到 `src/types/generated/`。

pub mod download_request;
pub mod editor;
pub mod host_dto;
pub mod progress;
pub mod remote_file;
pub mod remote_host;
pub mod settings;
pub mod storage_paths;
pub mod vault_sync;

pub use download_request::DownloadRequest;
pub use editor::{
    EditorErrorPayload, EditorSessionInvalidPayload, EditorSyncedPayload, RemoteEditSessionInfo,
};
pub use host_dto::HostDto;
pub use progress::{BatchProgressPayload, ConnectionStatusPayload, ProgressPayload};
pub use remote_file::RemoteFile;
pub use remote_host::RemoteHost;
pub use settings::AppSettings;
pub use storage_paths::StoragePaths;
pub use vault_sync::{
    VaultKdfParameters, VaultKeyEnvelope, VaultSyncSettings, VaultSyncStatus,
    VaultWebDavCredentials,
};
