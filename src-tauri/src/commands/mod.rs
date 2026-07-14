//! 对前端暴露的 Tauri 命令。
//!
//! 所有命令仅依赖 [`crate::transport::FileTransport`] trait 与
//! [`crate::core::SessionManager`]，不感知具体协议。
//! 命令名 `snake_case`，参数名 `camelCase`（Tauri 自动转换）。
//!
//! 完整命令清单见 `docs/03-api-spec.md`（connect_host / list_directory /
//! download_file / upload_file / delete_file / create_directory / move_file 等，
//! Phase 1 起逐步实现）。

use serde::Serialize;

use crate::enums::Protocol;

/// 应用元信息。
#[derive(Debug, Serialize)]
pub struct AppInfo {
    /// 应用名称
    pub name: String,
    /// 应用版本
    pub version: String,
}

/// 返回应用名称与版本（来自 Cargo.toml）。
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// 返回当前版本已支持的协议列表（驱动前端协议选择器）。
#[tauri::command]
pub fn get_supported_protocols() -> Vec<Protocol> {
    vec![Protocol::Sftp, Protocol::WebDav]
}
