#![allow(unknown_lints)]
#![allow(linker_messages)]

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
mod local_fs;
pub mod models;
pub mod storage;
pub mod transport;

use core::{EditSessionManager, SessionManager, TransferManager};

/// 启动 Tauri 应用：组装命令并运行事件循环。
///
/// 失败时打印错误而非 panic（遵循 AGENTS.md「禁止非测试 unwrap/expect」）。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::new())
        .manage(TransferManager::new())
        .manage(EditSessionManager::new())
        .invoke_handler(tauri::generate_handler![
            // 应用信息
            commands::get_app_info,
            commands::get_supported_protocols,
            // 连接管理
            commands::connect_host,
            commands::test_host_connection,
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
            commands::read_remote_text,
            commands::start_remote_edit,
            commands::list_remote_edit_sessions,
            commands::stop_remote_edit,
            // 文件操作
            commands::download_file,
            commands::upload_file,
            commands::transfer_entry,
            commands::begin_transfer,
            commands::cancel_transfer,
            commands::finish_transfer,
            commands::upload_content,
            commands::delete_file,
            commands::create_directory,
            commands::move_file,
            // 设置
            commands::load_settings,
            commands::save_settings,
            commands::export_settings_encrypted,
            commands::import_settings_encrypted,
            commands::get_vault_sync_status,
            commands::test_and_save_vault_webdav,
            commands::save_vault_backup_password,
            commands::enable_vault_sync,
            commands::sync_vault_now,
            commands::restore_vault_from_webdav,
            commands::pause_vault_sync,
            commands::resume_vault_sync,
            commands::export_portable_vault,
            commands::import_portable_vault,
            commands::get_storage_paths,
            commands::load_background_image,
            commands::get_font_size,
            commands::set_font_size,
            commands::get_hosts,
            commands::save_host,
            commands::reorder_hosts,
            commands::delete_host,
            commands::export_hosts,
            commands::import_hosts,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("SY-TFM 启动失败: {e}");
    }
}
