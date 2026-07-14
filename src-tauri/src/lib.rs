//! SY-TFM — Tiny File Manager：Tauri 后端库。
//!
//! 模块组织遵循 AGENTS.md §7：
//! - [`enums`]：全局枚举目录（唯一真理源）
//! - [`transport`]：FileTransport trait + adapter 工厂
//! - [`commands`]：对前端暴露的 Tauri 命令
//! - [`core`]：SessionManager 等核心业务
//! - [`crypto`]：SecretProtector（AES-256-GCM）+ key_storage
//! - [`storage`]：settings 读写 + 迁移
//! - [`models`]：数据模型
//! - [`error`]：统一错误类型 AppError

pub mod commands;
pub mod core;
pub mod crypto;
pub mod enums;
pub mod error;
pub mod models;
pub mod storage;
pub mod transport;

use core::SessionManager;

/// 启动 Tauri 应用：组装命令并运行事件循环。
///
/// 失败时打印错误而非 panic（遵循 AGENTS.md「禁止非测试 unwrap/expect」）。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .manage(SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            // 应用信息
            commands::get_app_info,
            commands::get_supported_protocols,
            // 连接管理
            commands::connect_host,
            commands::disconnect_host,
            commands::get_connection_status,
            commands::get_connected_hosts,
            commands::get_adapter_capabilities,
            commands::ensure_session,
            commands::release_session,
            // 文件浏览
            commands::list_directory,
            commands::change_directory,
            commands::get_working_directory,
            commands::navigate_to_path,
            commands::file_exists,
            // 文件操作
            commands::download_file,
            commands::upload_file,
            commands::upload_content,
            commands::delete_file,
            commands::create_directory,
            commands::move_file,
            // 设置
            commands::load_settings,
            commands::save_settings,
            commands::get_hosts,
            commands::save_host,
            commands::delete_host,
            commands::export_hosts,
            commands::import_hosts,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("SY-TFM 启动失败: {e}");
    }
}
