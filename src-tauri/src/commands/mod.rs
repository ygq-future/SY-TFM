//! 对前端暴露的 Tauri 命令。
//!
//! 所有命令仅依赖 [`crate::transport::FileTransport`] trait 与
//! [`crate::core::SessionManager`]，不感知具体协议。
//! 命令名 `snake_case`，参数名 `camelCase`（Tauri 自动转换）。
//!
//! 完整命令清单见 `docs/03-api-spec.md`。

use serde::Serialize;
use uuid::Uuid;

use crate::core::SessionManager;
use crate::enums::{AdapterCapability, ConnectionStatus, Protocol, SortColumn};
use crate::error::AppError;
use crate::models::{AppSettings, HostDto, RemoteFile, RemoteHost};
use crate::storage::SettingsService;

// ============================================================
// 返回值类型
// ============================================================

/// 应用元信息。
#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

/// connect_host 返回值。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResult {
    pub host_id: String,
    pub home_dir: String,
    pub protocol: Protocol,
    pub capabilities: AdapterCapability,
}

/// get_connection_status 返回值。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatusInfo {
    pub host_id: String,
    pub status: ConnectionStatus,
    pub is_connected: bool,
    pub current_path: Option<String>,
    pub session_age: Option<u64>,
    pub protocol: Option<Protocol>,
}

/// get_connected_hosts 返回值条目。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedHostInfo {
    pub host_id: String,
    pub host_name: String,
    pub current_path: String,
    pub protocol: Protocol,
    pub capabilities: AdapterCapability,
}

/// get_adapter_capabilities 返回值。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterCapabilitiesInfo {
    pub protocol: Protocol,
    pub capabilities: AdapterCapability,
    pub supported_columns: Vec<SortColumn>,
    pub supports_owner: bool,
    pub supports_permissions: bool,
    pub supports_symlinks: bool,
}

/// navigate_to_path 返回值。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigateResult {
    pub current_path: String,
    pub files: Vec<RemoteFile>,
}

/// 解析 host_id 字符串为 Uuid。
fn parse_uuid(id: &str) -> Result<Uuid, AppError> {
    Uuid::parse_str(id)
        .map_err(|e| AppError::new(crate::enums::ErrorCode::SessionNotFound, e.to_string()))
}

// ============================================================
// 应用信息命令
// ============================================================

/// 返回应用名称与版本。
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// 返回当前版本已支持的协议列表。
#[tauri::command]
pub fn get_supported_protocols() -> Vec<Protocol> {
    vec![Protocol::Sftp, Protocol::WebDav]
}

// ============================================================
// 连接管理命令
// ============================================================

/// 连接远程主机。
#[tauri::command]
pub async fn connect_host(
    host_id: String,
    password: Option<String>,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<ConnectResult, AppError> {
    let uuid = parse_uuid(&host_id)?;
    // 从配置加载主机
    let settings = SettingsService::load()?;
    let host = settings
        .hosts
        .iter()
        .find(|h| h.id == uuid)
        .ok_or_else(|| AppError::session_not_found(&host_id))?
        .clone();

    let (home_dir, protocol, capabilities) = session_manager
        .connect(&host, password.as_deref())
        .await?;

    Ok(ConnectResult {
        host_id,
        home_dir,
        protocol,
        capabilities,
    })
}

/// 断开主机连接。
#[tauri::command]
pub async fn disconnect_host(
    host_id: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.disconnect(uuid).await
}

/// 查询主机连接状态。
#[tauri::command]
pub async fn get_connection_status(
    host_id: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<ConnectionStatusInfo, AppError> {
    let uuid = parse_uuid(&host_id)?;
    let is_connected = session_manager.is_connected(uuid).await;
    if is_connected {
        let current_path = session_manager.get_current_path(uuid).await.ok();
        let session_age = session_manager.get_session_age(uuid).await.ok().flatten();
        let protocol = session_manager.get_protocol(uuid).await.ok();
        Ok(ConnectionStatusInfo {
            host_id,
            status: ConnectionStatus::Connected,
            is_connected: true,
            current_path,
            session_age,
            protocol,
        })
    } else {
        Ok(ConnectionStatusInfo {
            host_id,
            status: ConnectionStatus::Disconnected,
            is_connected: false,
            current_path: None,
            session_age: None,
            protocol: None,
        })
    }
}

/// 获取所有已连接的主机列表。
#[tauri::command]
pub async fn get_connected_hosts(
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<Vec<ConnectedHostInfo>, AppError> {
    let hosts = session_manager.connected_hosts().await;
    Ok(hosts
        .into_iter()
        .map(|(id, name, proto, path, caps)| ConnectedHostInfo {
            host_id: id.to_string(),
            host_name: name,
            current_path: path,
            protocol: proto,
            capabilities: caps,
        })
        .collect())
}

/// 查询 adapter 能力。
#[tauri::command]
pub async fn get_adapter_capabilities(
    host_id: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<AdapterCapabilitiesInfo, AppError> {
    let uuid = parse_uuid(&host_id)?;
    let caps = session_manager.get_capabilities(uuid).await?;
    let protocol = session_manager.get_protocol(uuid).await?;

    let supports_owner = caps.contains(AdapterCapability::OWNER_PERMISSIONS);
    let supports_permissions = caps.contains(AdapterCapability::OWNER_PERMISSIONS);
    let supports_symlinks = caps.contains(AdapterCapability::SYMLINKS);

    let mut supported_columns = vec![SortColumn::Name, SortColumn::Size, SortColumn::LastModified];
    if supports_owner {
        supported_columns.push(SortColumn::Owner);
        supported_columns.push(SortColumn::Permissions);
    }

    Ok(AdapterCapabilitiesInfo {
        protocol,
        capabilities: caps,
        supported_columns,
        supports_owner,
        supports_permissions,
        supports_symlinks,
    })
}

/// 确保主机有活跃会话（跨主机传输面板用）。
#[tauri::command]
pub async fn ensure_session(
    host_id: String,
    password: Option<String>,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<serde_json::Value, AppError> {
    let uuid = parse_uuid(&host_id)?;
    if !session_manager.is_connected(uuid).await {
        // 未连接则连接
        let settings = SettingsService::load()?;
        let host = settings
            .hosts
            .iter()
            .find(|h| h.id == uuid)
            .ok_or_else(|| AppError::session_not_found(&host_id))?
            .clone();
        let (home_dir, protocol, _) = session_manager
            .connect(&host, password.as_deref())
            .await?;
        Ok(serde_json::json!({
            "hostId": host_id,
            "homeDir": home_dir,
            "protocol": protocol,
        }))
    } else {
        let home_dir = session_manager.get_current_path(uuid).await?;
        let protocol = session_manager.get_protocol(uuid).await?;
        Ok(serde_json::json!({
            "hostId": host_id,
            "homeDir": home_dir,
            "protocol": protocol,
        }))
    }
}

/// 释放会话（断开连接）。
#[tauri::command]
pub async fn release_session(
    host_id: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.disconnect(uuid).await
}

// ============================================================
// 文件浏览命令
// ============================================================

/// 列出远程目录内容。
#[tauri::command]
pub async fn list_directory(
    host_id: String,
    path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<Vec<RemoteFile>, AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.list_directory(uuid, &path).await
}

/// 切换工作目录。
#[tauri::command]
pub async fn change_directory(
    host_id: String,
    path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<serde_json::Value, AppError> {
    let uuid = parse_uuid(&host_id)?;
    let current_path = session_manager.change_dir(uuid, &path).await?;
    Ok(serde_json::json!({ "currentPath": current_path }))
}

/// 获取当前工作目录。
#[tauri::command]
pub async fn get_working_directory(
    host_id: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<String, AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.get_working_dir(uuid).await
}

/// 切换目录并列表（原子操作）。
#[tauri::command]
pub async fn navigate_to_path(
    host_id: String,
    path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<NavigateResult, AppError> {
    let uuid = parse_uuid(&host_id)?;
    let (current_path, files) = session_manager.navigate(uuid, &path).await?;
    Ok(NavigateResult { current_path, files })
}

/// 检查文件/目录是否存在。
#[tauri::command]
pub async fn file_exists(
    host_id: String,
    path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<bool, AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.file_exists(uuid, &path).await
}

// ============================================================
// 文件操作命令
// ============================================================

/// 下载文件。
#[tauri::command]
pub async fn download_file(
    host_id: String,
    remote_path: String,
    local_path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager
        .download_file(uuid, &remote_path, &local_path)
        .await
}

/// 上传文件（本地路径）。
#[tauri::command]
pub async fn upload_file(
    host_id: String,
    local_path: String,
    remote_path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager
        .upload_file(uuid, &local_path, &remote_path)
        .await
}

/// 上传内存内容（拖拽/新建文件用）。
#[tauri::command]
pub async fn upload_content(
    host_id: String,
    remote_path: String,
    content: Vec<u8>,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager
        .upload_content(uuid, &remote_path, content)
        .await
}

/// 删除文件/目录。
#[tauri::command]
pub async fn delete_file(
    host_id: String,
    path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    // 尝试先按文件删，失败再按目录删
    match session_manager.delete_file(uuid, &path).await {
        Ok(()) => Ok(()),
        Err(_) => session_manager.delete_directory(uuid, &path).await,
    }
}

/// 创建目录。
#[tauri::command]
pub async fn create_directory(
    host_id: String,
    path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.create_directory(uuid, &path).await
}

/// 移动/重命名文件。
#[tauri::command]
pub async fn move_file(
    host_id: String,
    from: String,
    to: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    session_manager.move_file(uuid, &from, &to).await
}

// ============================================================
// 设置命令
// ============================================================

/// 加载应用配置。
#[tauri::command]
pub fn load_settings() -> Result<AppSettings, AppError> {
    SettingsService::load()
}

/// 保存应用配置。
#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), AppError> {
    SettingsService::save(&settings)
}

/// 获取主机列表。
#[tauri::command]
pub fn get_hosts() -> Result<Vec<RemoteHost>, AppError> {
    Ok(SettingsService::load()?.hosts)
}

/// 保存主机（新增/更新）。
#[tauri::command]
pub fn save_host(host: RemoteHost) -> Result<(), AppError> {
    let mut settings = SettingsService::load()?;
    // 加密密码（如果有明文密码）
    let mut host = host;
    if !host.password.is_empty()
        && !host.password.starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX)
    {
        if let Ok(key) = crate::crypto::key_storage::get_or_create_master_key() {
            let protector = crate::crypto::secret_protector::SecretProtector::new(key);
            if let Ok(encrypted) = protector.encrypt(&host.password) {
                host.password = encrypted;
            }
        }
    }
    // 更新或插入
    if let Some(existing) = settings.hosts.iter_mut().find(|h| h.id == host.id) {
        *existing = host;
    } else {
        settings.hosts.push(host);
    }
    SettingsService::save(&settings)
}

/// 删除主机。
#[tauri::command]
pub fn delete_host(host_id: String) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    let mut settings = SettingsService::load()?;
    settings.hosts.retain(|h| h.id != uuid);
    SettingsService::save(&settings)
}

/// 导出主机配置（不含密码）。
#[tauri::command]
pub fn export_hosts() -> Result<Vec<HostDto>, AppError> {
    let settings = SettingsService::load()?;
    Ok(settings.hosts.into_iter().map(HostDto::from).collect())
}

/// 导入主机配置。
#[tauri::command]
pub fn import_hosts(hosts: Vec<HostDto>) -> Result<(), AppError> {
    let mut settings = SettingsService::load()?;
    for dto in hosts {
        let host = RemoteHost {
            id: Uuid::new_v4(),
            name: dto.name,
            protocol: dto.protocol,
            host: dto.host,
            port: dto.port,
            username: dto.username,
            password: String::new(), // 导入不含密码
            tags: dto.tags,
            download_path: dto.download_path,
            https: dto.https,
            base_path: dto.base_path,
            is_connected: false,
        };
        settings.hosts.push(host);
    }
    SettingsService::save(&settings)
}
