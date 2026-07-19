//! 对前端暴露的 Tauri 命令。
//!
//! 所有命令仅依赖 [`crate::transport::FileTransport`] trait 与
//! [`crate::core::SessionManager`]，不感知具体协议。
//! 命令名 `snake_case`，参数名 `camelCase`（Tauri 自动转换）。
//!
//! 完整命令清单见 `docs/03-api-spec.md`。

use std::collections::HashSet;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use uuid::Uuid;

use crate::core::{EditSessionManager, SessionManager, TransferManager};
use crate::enums::app_directory::AppDirectory;
use crate::enums::app_event::AppEvent;
use crate::enums::edit_policy::EditPolicy;
use crate::enums::transfer_policy::TransferPolicy;
use crate::enums::{AdapterCapability, ConnectionStatus, Protocol, SortColumn};
use crate::error::AppError;
use crate::local_fs::{reject_existing_local_link, safe_local_child};
use crate::models::{
    AppSettings, BatchProgressPayload, ConnectionStatusPayload, DownloadRequest, HostDto,
    ProgressPayload, RemoteEditSessionInfo, RemoteFile, RemoteHost, VaultSyncStatus,
    VaultWebDavCredentials,
};
use crate::storage::SettingsService;
use crate::transport::ProgressEvent;

// ============================================================
// 返回值类型
// ============================================================

/// 应用元信息。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// 应用显示名称。
    pub name: String,
    /// 应用版本。
    pub version: String,
    /// 开发者。
    pub developer: String,
    /// 软件许可证。
    pub license: String,
    /// 项目主页。
    pub github_url: String,
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

/// 跨面板传输命令请求参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferEntryRequest {
    /// 来源主机 ID。
    pub source_host_id: String,
    /// 目标主机 ID。
    pub target_host_id: String,
    /// 来源路径。
    pub source_path: String,
    /// 目标路径。
    pub target_path: String,
    /// 是否为目录。
    pub is_directory: bool,
    /// 前端创建的传输操作 ID。
    pub operation_id: String,
}

/// 解析 host_id 字符串为 Uuid。
fn parse_uuid(id: &str) -> Result<Uuid, AppError> {
    Uuid::parse_str(id)
        .map_err(|e| AppError::new(crate::enums::ErrorCode::SessionNotFound, e.to_string()))
}

/// 发送连接状态事件；无监听者时不影响命令结果。
fn emit_connection_status(
    app: &tauri::AppHandle,
    host_id: Uuid,
    status: ConnectionStatus,
    message: Option<String>,
) {
    let _ = app.emit(
        AppEvent::ConnectionStatus.as_str(),
        ConnectionStatusPayload {
            host_id,
            status,
            message,
        },
    );
}

/// 启动协议无关的会话健康监控；真实连接丢失后由后端主动通知前端重连。
fn start_connection_monitor(app: tauri::AppHandle, session_manager: SessionManager, host_id: Uuid) {
    tauri::async_runtime::spawn(async move {
        if session_manager.monitor_connection(host_id).await {
            emit_connection_status(&app, host_id, ConnectionStatus::Reconnecting, None);
        }
    });
}

/// 将 adapter 进度通道转换为 Tauri 事件。
async fn forward_progress(
    app: tauri::AppHandle,
    host_id: Uuid,
    operation_id: String,
    mut receiver: tokio::sync::mpsc::Receiver<ProgressEvent>,
    progress_event: &'static str,
    done_event: &'static str,
    heartbeat: tokio::sync::mpsc::UnboundedSender<()>,
) {
    let started_at = Instant::now();
    let progress_interval =
        Duration::from_millis(TransferPolicy::ProgressIntervalMilliseconds.value());
    let mut last_emitted = Instant::now()
        .checked_sub(progress_interval)
        .unwrap_or_else(Instant::now);
    let mut latest = ProgressPayload {
        host_id,
        operation_id,
        transferred: 0,
        total: 0,
        percent: 0.0,
        speed: 0.0,
        current_file: String::new(),
    };

    while let Some(event) = receiver.recv().await {
        match event {
            ProgressEvent::Progress {
                transferred,
                total,
                current_file,
            } => {
                latest.transferred = transferred;
                latest.total = total;
                latest.percent = if total == 0 {
                    0.0
                } else {
                    transferred as f64 * 100.0 / total as f64
                };
                latest.speed = transferred as f64 / started_at.elapsed().as_secs_f64().max(0.001);
                latest.current_file = current_file;
                let _ = heartbeat.send(());
                if last_emitted.elapsed() >= progress_interval || transferred >= total {
                    let _ = app.emit(progress_event, &latest);
                    last_emitted = Instant::now();
                }
            }
            ProgressEvent::Done => {
                latest.percent = 100.0;
                let _ = heartbeat.send(());
                let _ = app.emit(done_event, &latest);
            }
            ProgressEvent::Error(message) => {
                latest.current_file = message;
                let _ = app.emit(progress_event, &latest);
            }
        }
    }
}

async fn wait_for_cancellation(mut cancellation: tokio::sync::watch::Receiver<bool>) {
    if *cancellation.borrow() {
        return;
    }
    while cancellation.changed().await.is_ok() {
        if *cancellation.borrow() {
            return;
        }
    }
    std::future::pending::<()>().await;
}

fn ensure_transfer_active(
    cancellation: &tokio::sync::watch::Receiver<bool>,
) -> Result<(), AppError> {
    if *cancellation.borrow() {
        return Err(AppError::new(
            crate::enums::ErrorCode::OperationCancelled,
            "传输已取消",
        ));
    }
    Ok(())
}

async fn run_controlled_transfer<T>(
    future: impl Future<Output = Result<T, AppError>>,
    cancellation: tokio::sync::watch::Receiver<bool>,
    mut heartbeat: tokio::sync::mpsc::UnboundedReceiver<()>,
) -> Result<T, AppError> {
    let operation = future;
    tokio::pin!(operation);
    let cancelled = wait_for_cancellation(cancellation);
    tokio::pin!(cancelled);
    let idle_timeout = Duration::from_secs(TransferPolicy::IdleTimeoutSeconds.value());
    let timer = tokio::time::sleep(idle_timeout);
    tokio::pin!(timer);

    loop {
        tokio::select! {
            result = &mut operation => return result,
            _ = &mut cancelled => {
                return Err(AppError::new(
                    crate::enums::ErrorCode::OperationCancelled,
                    "传输已取消",
                ));
            }
            Some(()) = heartbeat.recv() => {
                timer.as_mut().reset(tokio::time::Instant::now() + idle_timeout);
            }
            _ = &mut timer => {
                return Err(AppError::new(
                    crate::enums::ErrorCode::OperationTimeout,
                    "传输长时间没有收到数据，已自动停止",
                ));
            }
        }
    }
}

async fn run_cancellable_operation<T>(
    future: impl Future<Output = Result<T, AppError>>,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<T, AppError> {
    tokio::select! {
        result = future => result,
        _ = wait_for_cancellation(cancellation) => Err(AppError::new(
            crate::enums::ErrorCode::OperationCancelled,
            "传输已取消",
        )),
    }
}

fn join_remote_path(parent: &str, name: &str) -> String {
    let separator = if parent.contains('\\') && !parent.contains('/') {
        '\\'
    } else {
        '/'
    };
    format!(
        "{}{}{}",
        parent.trim_end_matches(['/', '\\']),
        separator,
        name
    )
}

async fn download_one(
    app: &tauri::AppHandle,
    session_manager: &SessionManager,
    host_id: Uuid,
    remote_path: &str,
    local_path: &str,
    operation_id: &str,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<(), AppError> {
    let (progress, receiver) = tokio::sync::mpsc::channel(32);
    let (heartbeat_tx, heartbeat_rx) = tokio::sync::mpsc::unbounded_channel();
    let forwarder = tokio::spawn(forward_progress(
        app.clone(),
        host_id,
        operation_id.to_string(),
        receiver,
        AppEvent::DownloadProgress.as_str(),
        AppEvent::DownloadDone.as_str(),
        heartbeat_tx,
    ));
    let result = run_controlled_transfer(
        session_manager.download_file(host_id, remote_path, local_path, progress),
        cancellation,
        heartbeat_rx,
    )
    .await;
    let _ = forwarder.await;
    result
}

async fn upload_one(
    app: &tauri::AppHandle,
    session_manager: &SessionManager,
    host_id: Uuid,
    local_path: &str,
    remote_path: &str,
    operation_id: &str,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<(), AppError> {
    let (progress, receiver) = tokio::sync::mpsc::channel(32);
    let (heartbeat_tx, heartbeat_rx) = tokio::sync::mpsc::unbounded_channel();
    let forwarder = tokio::spawn(forward_progress(
        app.clone(),
        host_id,
        operation_id.to_string(),
        receiver,
        AppEvent::UploadProgress.as_str(),
        AppEvent::UploadDone.as_str(),
        heartbeat_tx,
    ));
    let result = run_controlled_transfer(
        session_manager.upload_file(host_id, local_path, remote_path, progress),
        cancellation,
        heartbeat_rx,
    )
    .await;
    let _ = forwarder.await;
    result
}

fn storage_write_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(
        crate::enums::ErrorCode::StorageWriteFailed,
        error.to_string(),
    )
}

fn download_target_path(local_directory: &Path, local_name: &str) -> Result<PathBuf, AppError> {
    safe_local_child(local_directory, local_name).map_err(storage_write_error)
}

fn download_entry_path(local_directory: &Path, entry_name: &str) -> Result<PathBuf, AppError> {
    safe_local_child(local_directory, entry_name).map_err(storage_write_error)
}

fn ensure_download_directory_path(path: &Path) -> Result<(), AppError> {
    reject_existing_local_link(path).map_err(storage_write_error)
}

async fn create_download_directory(path: &Path) -> Result<(), AppError> {
    ensure_download_directory_path(path)?;
    tokio::fs::create_dir_all(path)
        .await
        .map_err(storage_write_error)
}

async fn download_directory_tree(
    app: &tauri::AppHandle,
    session_manager: &SessionManager,
    host_id: Uuid,
    remote_root: &str,
    local_root: &Path,
    operation_id: &str,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<(), AppError> {
    ensure_transfer_active(&cancellation)?;
    create_download_directory(local_root).await?;
    let mut pending = vec![(remote_root.to_string(), local_root.to_path_buf())];
    let mut downloads: Vec<(String, PathBuf, String)> = Vec::new();
    while let Some((remote_directory, local_directory)) = pending.pop() {
        ensure_transfer_active(&cancellation)?;
        ensure_download_directory_path(&local_directory)?;
        let entries = run_cancellable_operation(
            session_manager.list_directory(host_id, &remote_directory),
            cancellation.clone(),
        )
        .await?;
        for entry in entries
            .into_iter()
            .filter(|entry| entry.name != "." && entry.name != "..")
        {
            let local_entry = download_entry_path(&local_directory, &entry.name)?;
            if entry.is_directory {
                create_download_directory(&local_entry).await?;
                pending.push((entry.full_path, local_entry));
            } else {
                downloads.push((entry.full_path, local_entry, entry.name));
            }
        }
    }

    let total_count = downloads.len();
    for (index, (remote_path, local_path, file_name)) in downloads.into_iter().enumerate() {
        ensure_transfer_active(&cancellation)?;
        let local_path = local_path.to_string_lossy().into_owned();
        let mut batch = BatchProgressPayload {
            host_id,
            operation_id: operation_id.to_string(),
            current_index: index + 1,
            total_count,
            current_file: file_name,
            file_percent: 0.0,
        };
        let _ = app.emit(AppEvent::DownloadBatchProgress.as_str(), &batch);
        download_one(
            app,
            session_manager,
            host_id,
            &remote_path,
            &local_path,
            operation_id,
            cancellation.clone(),
        )
        .await?;
        batch.file_percent = 100.0;
        let _ = app.emit(AppEvent::DownloadBatchProgress.as_str(), &batch);
    }
    Ok(())
}

async fn upload_local_tree(
    app: &tauri::AppHandle,
    session_manager: &SessionManager,
    host_id: Uuid,
    local_root: &Path,
    remote_root: &str,
    operation_id: &str,
    cancellation: tokio::sync::watch::Receiver<bool>,
) -> Result<(), AppError> {
    ensure_transfer_active(&cancellation)?;
    run_cancellable_operation(
        session_manager.create_directory(host_id, remote_root),
        cancellation.clone(),
    )
    .await?;
    let mut pending = vec![(local_root.to_path_buf(), remote_root.to_string())];
    while let Some((local_directory, remote_directory)) = pending.pop() {
        ensure_transfer_active(&cancellation)?;
        let mut entries = tokio::fs::read_dir(&local_directory).await?;
        while let Some(entry) = entries.next_entry().await? {
            ensure_transfer_active(&cancellation)?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let local_entry = entry.path();
            let remote_entry = join_remote_path(&remote_directory, &name);
            if entry.file_type().await?.is_dir() {
                run_cancellable_operation(
                    session_manager.create_directory(host_id, &remote_entry),
                    cancellation.clone(),
                )
                .await?;
                pending.push((local_entry, remote_entry));
            } else {
                let local_path = local_entry.to_string_lossy().into_owned();
                upload_one(
                    app,
                    session_manager,
                    host_id,
                    &local_path,
                    &remote_entry,
                    operation_id,
                    cancellation.clone(),
                )
                .await?;
            }
        }
    }
    Ok(())
}

struct RelayContext<'a> {
    app: &'a tauri::AppHandle,
    session_manager: &'a SessionManager,
    source_host_id: Uuid,
    target_host_id: Uuid,
    operation_id: &'a str,
    cancellation: tokio::sync::watch::Receiver<bool>,
}

async fn relay_file(
    context: RelayContext<'_>,
    source_path: &str,
    target_path: &str,
) -> Result<(), AppError> {
    let temporary_path = std::env::temp_dir().join(format!("sy-tfm-relay-{}", Uuid::new_v4()));
    let temporary = temporary_path.to_string_lossy().into_owned();
    let result = async {
        download_one(
            context.app,
            context.session_manager,
            context.source_host_id,
            source_path,
            &temporary,
            context.operation_id,
            context.cancellation.clone(),
        )
        .await?;
        upload_one(
            context.app,
            context.session_manager,
            context.target_host_id,
            &temporary,
            target_path,
            context.operation_id,
            context.cancellation,
        )
        .await
    }
    .await;
    let _ = tokio::fs::remove_file(temporary_path).await;
    result
}

// ============================================================
// 应用信息命令
// ============================================================

/// 返回应用名称与版本。
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "SY-TFM".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        developer: "Sheepyu".to_string(),
        license: "MIT".to_string(),
        github_url: "https://github.com/ygq-future/SY-TFM".to_string(),
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
    app: tauri::AppHandle,
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

    if session_manager.is_connected(uuid).await {
        session_manager.disconnect(uuid).await?;
    }
    emit_connection_status(&app, uuid, ConnectionStatus::Connecting, None);
    let connection = session_manager.connect(&host, password.as_deref()).await;
    let (home_dir, protocol, capabilities) = match connection {
        Ok(result) => result,
        Err(error) => {
            emit_connection_status(
                &app,
                uuid,
                ConnectionStatus::Error,
                Some(error.message.clone()),
            );
            return Err(error);
        }
    };
    emit_connection_status(&app, uuid, ConnectionStatus::Connected, None);
    start_connection_monitor(app, session_manager.inner().clone(), uuid);

    Ok(ConnectResult {
        host_id,
        home_dir,
        protocol,
        capabilities,
    })
}

/// 使用当前表单配置建立一次隔离连接，不保存配置或占用正式会话。
#[tauri::command]
pub async fn test_host_connection(
    mut host: RemoteHost,
    password: Option<String>,
) -> Result<(), AppError> {
    if host.password.is_empty() {
        if let Some(saved) = SettingsService::load()?
            .hosts
            .into_iter()
            .find(|saved| saved.id == host.id)
        {
            host.password = saved.password;
        }
    }

    let tester = SessionManager::new();
    tester.connect(&host, password.as_deref()).await?;
    tester.disconnect(host.id).await
}

/// 断开主机连接。
#[tauri::command]
pub async fn disconnect_host(
    host_id: String,
    app: tauri::AppHandle,
    session_manager: tauri::State<'_, SessionManager>,
    transfer_manager: tauri::State<'_, TransferManager>,
    edit_session_manager: tauri::State<'_, EditSessionManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    emit_connection_status(&app, uuid, ConnectionStatus::Disconnecting, None);
    transfer_manager.cancel_host(uuid).await;
    edit_session_manager.stop_for_host(&app, uuid);
    session_manager.disconnect(uuid).await?;
    emit_connection_status(&app, uuid, ConnectionStatus::Disconnected, None);
    Ok(())
}

/// 将远程文本文件读取到内存，供内置在线编辑器使用。
#[tauri::command]
pub async fn read_remote_text(
    host_id: String,
    remote_path: String,
    session_manager: tauri::State<'_, SessionManager>,
) -> Result<String, AppError> {
    let uuid = parse_uuid(&host_id)?;
    let temporary_path = std::env::temp_dir().join(format!("sy-tfm-online-{}", Uuid::new_v4()));
    let temporary_path_text = temporary_path.to_string_lossy().into_owned();
    let (progress, mut receiver) = tokio::sync::mpsc::channel(16);
    tauri::async_runtime::spawn(async move { while receiver.recv().await.is_some() {} });
    session_manager
        .download_file(uuid, &remote_path, &temporary_path_text, progress)
        .await?;

    let result = async {
        let metadata = tokio::fs::metadata(&temporary_path).await?;
        if metadata.len() > EditPolicy::MaxOnlineFileBytes.value() {
            return Err(AppError::unsupported(format!(
                "Online editing supports files up to {} MiB",
                EditPolicy::MaxOnlineFileBytes.value() / 1024 / 1024,
            )));
        }
        let bytes = tokio::fs::read(&temporary_path).await?;
        String::from_utf8(bytes).map_err(|_| {
            AppError::unsupported("This file is not UTF-8 text and cannot be edited online")
        })
    }
    .await;
    let _ = tokio::fs::remove_file(&temporary_path).await;
    result
}

/// 启动外部编辑会话并返回本地临时文件路径。
#[tauri::command]
pub async fn start_remote_edit(
    host_id: String,
    remote_path: String,
    file_name: String,
    app: tauri::AppHandle,
    session_manager: tauri::State<'_, SessionManager>,
    edit_session_manager: tauri::State<'_, EditSessionManager>,
) -> Result<RemoteEditSessionInfo, AppError> {
    let uuid = parse_uuid(&host_id)?;
    edit_session_manager
        .start(
            app,
            session_manager.inner().clone(),
            uuid,
            remote_path,
            file_name,
        )
        .await
}

/// 列出指定主机当前仍有效的外部编辑监听会话。
#[tauri::command]
pub fn list_remote_edit_sessions(
    host_id: String,
    edit_session_manager: tauri::State<'_, EditSessionManager>,
) -> Result<Vec<RemoteEditSessionInfo>, AppError> {
    Ok(edit_session_manager.list_for_host(parse_uuid(&host_id)?))
}

/// 停止外部编辑会话并清理对应临时文件。
#[tauri::command]
pub async fn stop_remote_edit(
    edit_session_id: String,
    edit_session_manager: tauri::State<'_, EditSessionManager>,
) -> Result<bool, AppError> {
    Ok(edit_session_manager.stop(parse_uuid(&edit_session_id)?))
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
        let (home_dir, protocol, _) = session_manager.connect(&host, password.as_deref()).await?;
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
    Ok(NavigateResult {
        current_path,
        files,
    })
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

/// 注册一项可并发、可取消的传输任务。
#[tauri::command]
pub async fn begin_transfer(
    operation_id: String,
    host_ids: Vec<String>,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<(), AppError> {
    let mut parsed = Vec::with_capacity(host_ids.len());
    for host_id in host_ids {
        parsed.push(parse_uuid(&host_id)?);
    }
    transfer_manager.begin(operation_id, parsed).await;
    Ok(())
}

/// 请求取消指定传输任务。
#[tauri::command]
pub async fn cancel_transfer(
    operation_id: String,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<bool, AppError> {
    Ok(transfer_manager.cancel(&operation_id).await)
}

/// 释放已结束传输的取消句柄。
#[tauri::command]
pub async fn finish_transfer(
    operation_id: String,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<(), AppError> {
    transfer_manager.finish(&operation_id).await;
    Ok(())
}

/// 下载文件。
#[tauri::command]
pub async fn download_file(
    request: DownloadRequest,
    app: tauri::AppHandle,
    session_manager: tauri::State<'_, SessionManager>,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&request.host_id)?;
    let local_path =
        download_target_path(Path::new(&request.local_directory), &request.local_name)?;
    let cancellation = transfer_manager.cancellation(&request.operation_id).await?;
    if request.is_directory {
        download_directory_tree(
            &app,
            &session_manager,
            uuid,
            &request.remote_path,
            &local_path,
            &request.operation_id,
            cancellation,
        )
        .await
    } else {
        if let Some(parent) = local_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(storage_write_error)?;
        }
        let local_path = local_path.to_string_lossy().into_owned();
        download_one(
            &app,
            &session_manager,
            uuid,
            &request.remote_path,
            &local_path,
            &request.operation_id,
            cancellation,
        )
        .await
    }
}

/// 上传文件（本地路径）。
#[tauri::command]
pub async fn upload_file(
    host_id: String,
    local_path: String,
    remote_path: String,
    operation_id: String,
    app: tauri::AppHandle,
    session_manager: tauri::State<'_, SessionManager>,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    let cancellation = transfer_manager.cancellation(&operation_id).await?;
    let metadata = tokio::fs::metadata(&local_path).await?;
    if metadata.is_dir() {
        upload_local_tree(
            &app,
            &session_manager,
            uuid,
            Path::new(&local_path),
            &remote_path,
            &operation_id,
            cancellation,
        )
        .await
    } else {
        upload_one(
            &app,
            &session_manager,
            uuid,
            &local_path,
            &remote_path,
            &operation_id,
            cancellation,
        )
        .await
    }
}

/// 在两个已连接会话之间传输文件或目录。
#[tauri::command]
pub async fn transfer_entry(
    request: TransferEntryRequest,
    app: tauri::AppHandle,
    session_manager: tauri::State<'_, SessionManager>,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<(), AppError> {
    let source_uuid = parse_uuid(&request.source_host_id)?;
    let target_uuid = parse_uuid(&request.target_host_id)?;
    let cancellation = transfer_manager.cancellation(&request.operation_id).await?;
    if !request.is_directory {
        return relay_file(
            RelayContext {
                app: &app,
                session_manager: &session_manager,
                source_host_id: source_uuid,
                target_host_id: target_uuid,
                operation_id: &request.operation_id,
                cancellation,
            },
            &request.source_path,
            &request.target_path,
        )
        .await;
    }

    ensure_transfer_active(&cancellation)?;
    run_cancellable_operation(
        session_manager.create_directory(target_uuid, &request.target_path),
        cancellation.clone(),
    )
    .await?;
    let mut pending = vec![(request.source_path, request.target_path)];
    while let Some((source_directory, target_directory)) = pending.pop() {
        ensure_transfer_active(&cancellation)?;
        let entries = run_cancellable_operation(
            session_manager.list_directory(source_uuid, &source_directory),
            cancellation.clone(),
        )
        .await?;
        for entry in entries
            .into_iter()
            .filter(|entry| entry.name != "." && entry.name != "..")
        {
            ensure_transfer_active(&cancellation)?;
            let target_entry = join_remote_path(&target_directory, &entry.name);
            if entry.is_directory {
                run_cancellable_operation(
                    session_manager.create_directory(target_uuid, &target_entry),
                    cancellation.clone(),
                )
                .await?;
                pending.push((entry.full_path, target_entry));
            } else {
                relay_file(
                    RelayContext {
                        app: &app,
                        session_manager: &session_manager,
                        source_host_id: source_uuid,
                        target_host_id: target_uuid,
                        operation_id: &request.operation_id,
                        cancellation: cancellation.clone(),
                    },
                    &entry.full_path,
                    &target_entry,
                )
                .await?;
            }
        }
    }
    Ok(())
}

/// 上传内存内容（拖拽/新建文件用）。
#[tauri::command]
pub async fn upload_content(
    host_id: String,
    remote_path: String,
    content: Vec<u8>,
    operation_id: String,
    app: tauri::AppHandle,
    session_manager: tauri::State<'_, SessionManager>,
    transfer_manager: tauri::State<'_, TransferManager>,
) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    let cancellation = transfer_manager.cancellation(&operation_id).await?;
    let (progress, receiver) = tokio::sync::mpsc::channel(32);
    let (heartbeat_tx, heartbeat_rx) = tokio::sync::mpsc::unbounded_channel();
    let forwarder = tokio::spawn(forward_progress(
        app,
        uuid,
        operation_id,
        receiver,
        AppEvent::UploadProgress.as_str(),
        AppEvent::UploadDone.as_str(),
        heartbeat_tx,
    ));
    let result = run_controlled_transfer(
        session_manager.upload_content(uuid, &remote_path, content, progress),
        cancellation,
        heartbeat_rx,
    )
    .await;
    let _ = forwarder.await;
    result
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
    SettingsService::save(&settings)?;
    crate::core::vault_sync::schedule_auto_sync();
    Ok(())
}

/// 将完整配置加密导出到指定文件。
#[tauri::command]
pub fn export_settings_encrypted(file_path: String) -> Result<(), AppError> {
    let settings = SettingsService::load()?;
    let plaintext = serde_json::to_string(&settings)?;
    let key = crate::crypto::key_storage::get_or_create_master_key()?;
    let encrypted =
        crate::crypto::secret_protector::SecretProtector::new(key).encrypt(&plaintext)?;
    std::fs::write(file_path, encrypted).map_err(|error| {
        AppError::new(
            crate::enums::ErrorCode::StorageWriteFailed,
            error.to_string(),
        )
    })
}

/// 从加密备份导入完整配置。
#[tauri::command]
pub fn import_settings_encrypted(file_path: String) -> Result<AppSettings, AppError> {
    let encrypted = std::fs::read_to_string(file_path)?;
    let key = crate::crypto::key_storage::get_or_create_master_key()?;
    let plaintext = crate::crypto::secret_protector::SecretProtector::new(key)
        .decrypt(&encrypted)
        .map_err(|_| {
            AppError::new(
                crate::enums::ErrorCode::CryptoDecryptFailed,
                "配置备份无法解密：系统密钥不匹配或文件已损坏",
            )
        })?;
    let mut settings: AppSettings = serde_json::from_str(&plaintext)?;
    settings.config_version = 3;
    SettingsService::save(&settings)?;
    Ok(settings)
}

/// 获取跨设备保险库的 WebDAV 同步状态。
#[tauri::command]
pub fn get_vault_sync_status() -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::status()
}

/// 首次创建跨设备保险库并上传至 WebDAV 的固定 `SY-TFM` 目录。
#[tauri::command]
pub async fn enable_vault_sync(
    credentials: VaultWebDavCredentials,
    backup_password: Option<String>,
    overwrite_existing: bool,
) -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::enable(credentials, backup_password, overwrite_existing).await
}

/// 验证并保存保险库使用的 WebDAV 地址、凭据与可选共用备份密码。
#[tauri::command]
pub async fn test_and_save_vault_webdav(
    credentials: VaultWebDavCredentials,
    backup_password: Option<String>,
) -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::test_and_save(credentials, backup_password).await
}

/// 校验并保存便携备份与 WebDAV 恢复共用的备份密码。
#[tauri::command]
pub async fn save_vault_backup_password(
    password: String,
    confirmation: String,
) -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::save_backup_password(password, confirmation).await
}

/// 立即把当前设置上传为新的保险库 revision。
#[tauri::command]
pub async fn sync_vault_now(backup_password: Option<String>) -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::sync_now(backup_password).await
}

/// 从 WebDAV 的固定 `SY-TFM` 目录恢复跨设备保险库。
#[tauri::command]
pub async fn restore_vault_from_webdav(
    credentials: VaultWebDavCredentials,
    backup_password: Option<String>,
) -> Result<AppSettings, AppError> {
    crate::core::vault_sync::restore(credentials, backup_password).await
}

/// 暂停当前设备的保险库同步，保留本机配置和云端加密文件。
#[tauri::command]
pub async fn pause_vault_sync() -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::pause().await
}

/// 恢复已初始化保险库的同步。
#[tauri::command]
pub async fn resume_vault_sync() -> Result<VaultSyncStatus, AppError> {
    crate::core::vault_sync::resume().await
}

/// 导出可通过用户备份密码在其他设备解密的便携保险库。
#[tauri::command]
pub fn export_portable_vault(
    file_path: String,
    backup_password: Option<String>,
) -> Result<(), AppError> {
    crate::core::vault_sync::export_file(file_path, backup_password)
}

/// 导入便携保险库，并使用当前设备的系统主密钥重新保护主机密码。
#[tauri::command]
pub fn import_portable_vault(
    file_path: String,
    backup_password: Option<String>,
) -> Result<AppSettings, AppError> {
    crate::core::vault_sync::import_file(file_path, backup_password)
}

/// 获取当前平台解析后的默认下载与应用数据目录。
#[tauri::command]
pub fn get_storage_paths() -> Result<crate::models::StoragePaths, AppError> {
    let user_dirs = directories::UserDirs::new().ok_or_else(|| {
        AppError::new(
            crate::enums::ErrorCode::PlatformUnsupported,
            "无法确定当前用户目录",
        )
    })?;
    let download_path =
        resolved_download_path(user_dirs.download_dir().unwrap_or(user_dirs.home_dir()));
    Ok(crate::models::StoragePaths {
        default_download_path: download_path.to_string_lossy().into_owned(),
        default_data_path: SettingsService::default_data_dir()?
            .to_string_lossy()
            .into_owned(),
        portable_mode: crate::storage::portable_mode::portable_data_dir()?.is_some(),
    })
}

fn resolved_download_path(base: &Path) -> PathBuf {
    base.join(AppDirectory::DownloadRoot.as_str())
}

/// 安全读取本地背景图片并转换为 WebView 可直接使用的 Data URL。
#[tauri::command]
pub fn load_background_image(file_path: String) -> Result<String, AppError> {
    let path = std::path::PathBuf::from(file_path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| {
            AppError::new(
                crate::enums::ErrorCode::StorageReadFailed,
                "背景图片缺少有效扩展名",
            )
        })?;
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        _ => {
            return Err(AppError::new(
                crate::enums::ErrorCode::StorageReadFailed,
                "不支持的背景图片格式",
            ));
        }
    };
    let metadata = std::fs::metadata(&path)?;
    if metadata.len() > 20 * 1024 * 1024 {
        return Err(AppError::new(
            crate::enums::ErrorCode::StorageReadFailed,
            "背景图片不能超过 20 MB",
        ));
    }
    let bytes = std::fs::read(path)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

/// 获取界面基础字号。
#[tauri::command]
pub fn get_font_size() -> Result<u8, AppError> {
    Ok(SettingsService::load()?.font_size)
}

/// 保存界面基础字号。
#[tauri::command]
pub fn set_font_size(font_size: u8) -> Result<(), AppError> {
    let mut settings = SettingsService::load()?;
    settings.font_size = font_size.clamp(10, 18);
    SettingsService::save(&settings)?;
    crate::core::vault_sync::schedule_auto_sync();
    Ok(())
}

/// 获取主机列表。
#[tauri::command]
pub fn get_hosts() -> Result<Vec<RemoteHost>, AppError> {
    Ok(SettingsService::load()?.hosts)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PasswordUpdate {
    Preserve,
    Clear,
    Replace,
}

fn password_update(existing: &str, incoming: &str, clear_password: bool) -> PasswordUpdate {
    if clear_password {
        PasswordUpdate::Clear
    } else if incoming.is_empty() && !existing.is_empty() {
        PasswordUpdate::Preserve
    } else if incoming.is_empty() {
        PasswordUpdate::Clear
    } else {
        PasswordUpdate::Replace
    }
}

/// 保存主机（新增/更新）。空密码保留已有密文，只有显式清除才会删除。
#[tauri::command]
pub fn save_host(host: RemoteHost, clear_password: Option<bool>) -> Result<(), AppError> {
    let mut settings = SettingsService::load()?;
    let mut host = host;
    let existing_password = settings
        .hosts
        .iter()
        .find(|existing| existing.id == host.id)
        .map(|existing| existing.password.as_str())
        .unwrap_or_default();

    match password_update(
        existing_password,
        &host.password,
        clear_password.unwrap_or(false),
    ) {
        PasswordUpdate::Preserve => host.password = existing_password.to_string(),
        PasswordUpdate::Clear => host.password.clear(),
        PasswordUpdate::Replace => {
            if !host
                .password
                .starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX)
            {
                let key = crate::crypto::key_storage::get_or_create_master_key()?;
                let protector = crate::crypto::secret_protector::SecretProtector::new(key);
                host.password = protector.encrypt(&host.password)?;
            }
        }
    }

    if let Some(existing) = settings.hosts.iter_mut().find(|h| h.id == host.id) {
        *existing = host;
    } else {
        settings.hosts.push(host);
    }
    SettingsService::save(&settings)?;
    crate::core::vault_sync::schedule_auto_sync();
    Ok(())
}

fn reorder_hosts_in_memory(
    hosts: &[RemoteHost],
    host_ids: &[Uuid],
) -> Result<Vec<RemoteHost>, AppError> {
    let unique_ids = host_ids.iter().copied().collect::<HashSet<_>>();
    if host_ids.len() != hosts.len() || unique_ids.len() != hosts.len() {
        return Err(AppError::new(
            crate::enums::ErrorCode::StorageWriteFailed,
            "Host order must contain every saved host exactly once",
        ));
    }

    host_ids
        .iter()
        .map(|id| {
            hosts
                .iter()
                .find(|host| host.id == *id)
                .cloned()
                .ok_or_else(|| {
                    AppError::new(
                        crate::enums::ErrorCode::StorageWriteFailed,
                        format!("Host order contains an unknown host: {id}"),
                    )
                })
        })
        .collect()
}

/// 按给定 ID 顺序原子保存主机列表；不改变任何主机字段或密码。
#[tauri::command]
pub fn reorder_hosts(host_ids: Vec<String>) -> Result<(), AppError> {
    let host_ids = host_ids
        .iter()
        .map(|id| parse_uuid(id))
        .collect::<Result<Vec<_>, _>>()?;
    let mut settings = SettingsService::load()?;
    settings.hosts = reorder_hosts_in_memory(&settings.hosts, &host_ids)?;
    SettingsService::save(&settings)?;
    crate::core::vault_sync::schedule_auto_sync();
    Ok(())
}

#[cfg(test)]
mod password_update_tests {
    use super::*;
    use crate::enums::ErrorCode;

    #[test]
    fn download_target_rejects_unsafe_top_level_names_and_base_directories() {
        let directory = std::env::temp_dir().join("sy-tfm-download-tests");
        for name in ["../x", "C:\\x", "CON.txt"] {
            assert!(download_target_path(&directory, name).is_err(), "{name:?}");
        }
        assert!(download_target_path(Path::new(""), "file.txt").is_err());
        assert!(download_target_path(Path::new("relative"), "file.txt").is_err());
        assert_eq!(
            download_target_path(&directory, "中文-😀.txt").expect("valid local name"),
            directory.join("中文-😀.txt")
        );
    }

    #[test]
    fn recursive_download_child_rejects_unsafe_entry_names() {
        let directory = std::env::temp_dir()
            .join("sy-tfm-download-tests")
            .join("folder");
        for name in ["../x", "C:\\x", "CON.txt"] {
            assert!(download_entry_path(&directory, name).is_err(), "{name:?}");
        }
        assert_eq!(
            download_entry_path(&directory, "子目录-😀").expect("valid local name"),
            directory.join("子目录-😀")
        );
    }

    #[test]
    fn existing_symlink_download_targets_are_rejected() {
        let root = std::env::temp_dir().join(format!("sy-tfm-link-test-{}", Uuid::new_v4()));
        let outside = root.join("outside");
        let base = root.join("base");
        std::fs::create_dir_all(&outside).expect("create outside directory");
        std::fs::create_dir_all(&base).expect("create download base");
        let link = base.join("linked");

        #[cfg(unix)]
        if std::os::unix::fs::symlink(&outside, &link).is_err() {
            let _ = std::fs::remove_dir_all(&root);
            return;
        }
        #[cfg(windows)]
        if std::os::windows::fs::symlink_dir(&outside, &link).is_err() {
            let _ = std::fs::remove_dir_all(&root);
            return;
        }

        assert!(download_target_path(&base, "linked").is_err());
        assert!(ensure_download_directory_path(&link).is_err());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn trusted_symlink_base_directory_is_allowed_for_file_download_setup() {
        let root = std::env::temp_dir().join(format!("sy-tfm-base-link-test-{}", Uuid::new_v4()));
        let real_base = root.join("real-base");
        let linked_base = root.join("linked-base");
        std::fs::create_dir_all(&real_base).expect("create real base");

        #[cfg(unix)]
        if std::os::unix::fs::symlink(&real_base, &linked_base).is_err() {
            let _ = std::fs::remove_dir_all(&root);
            return;
        }
        #[cfg(windows)]
        if std::os::windows::fs::symlink_dir(&real_base, &linked_base).is_err() {
            let _ = std::fs::remove_dir_all(&root);
            return;
        }

        let target = download_target_path(&linked_base, "file.txt")
            .expect("trusted base should allow a new child");
        tokio::fs::create_dir_all(target.parent().expect("target parent"))
            .await
            .expect("trusted symlink base should remain usable");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn local_directory_creation_errors_are_storage_write_failures() {
        let root = std::env::temp_dir().join(format!("sy-tfm-write-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("create test directory");
        let file = root.join("file");
        std::fs::write(&file, b"content").expect("create blocking file");

        let error = create_download_directory(&file.join("child"))
            .await
            .expect_err("directory creation should fail");
        assert_eq!(error.code, ErrorCode::StorageWriteFailed);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn cancellable_remote_operation_stops_without_waiting_for_the_operation() {
        let (cancellation_tx, cancellation) = tokio::sync::watch::channel(false);
        let operation =
            run_cancellable_operation(std::future::pending::<Result<(), AppError>>(), cancellation);
        let task = tokio::spawn(operation);
        cancellation_tx.send_replace(true);

        let result = tokio::time::timeout(Duration::from_millis(100), task)
            .await
            .expect("cancellation should not wait for the remote operation")
            .expect("cancellable task should finish");
        assert!(matches!(
            result,
            Err(AppError {
                code: ErrorCode::OperationCancelled,
                ..
            })
        ));
    }

    #[test]
    fn blank_edit_preserves_existing_password_unless_explicitly_cleared() {
        assert_eq!(
            password_update("enc.v1:existing", "", false),
            PasswordUpdate::Preserve
        );
        assert_eq!(
            password_update("enc.v1:existing", "", true),
            PasswordUpdate::Clear
        );
        assert_eq!(
            password_update("enc.v1:existing", "replacement", false),
            PasswordUpdate::Replace
        );
    }

    #[test]
    fn default_download_path_uses_the_app_subdirectory() {
        let resolved = resolved_download_path(Path::new("Downloads"));
        assert_eq!(
            resolved.file_name().and_then(|value| value.to_str()),
            Some("SY-TFM")
        );
    }

    #[test]
    fn host_reordering_preserves_complete_host_records() {
        fn host(id: Uuid, name: &str, password: &str) -> RemoteHost {
            RemoteHost {
                id,
                name: name.to_string(),
                protocol: crate::enums::Protocol::Sftp,
                host: format!("{name}.example.com"),
                port: 22,
                username: "user".to_string(),
                password: password.to_string(),
                tags: String::new(),
                download_path: None,
                https: true,
                base_path: None,
                sftp_host_key_fingerprint: None,
                is_connected: false,
            }
        }

        let first_id = Uuid::from_u128(1);
        let second_id = Uuid::from_u128(2);
        let hosts = vec![
            host(first_id, "first", "enc.v1:first"),
            host(second_id, "second", "enc.v1:second"),
        ];
        let reordered = reorder_hosts_in_memory(&hosts, &[second_id, first_id])
            .expect("valid host order should be accepted");

        assert_eq!(reordered[0].id, second_id);
        assert_eq!(reordered[0].password, "enc.v1:second");
        assert!(reorder_hosts_in_memory(&hosts, &[first_id]).is_err());
        assert!(reorder_hosts_in_memory(&hosts, &[first_id, first_id]).is_err());
    }
}

/// 删除主机。
#[tauri::command]
pub fn delete_host(host_id: String) -> Result<(), AppError> {
    let uuid = parse_uuid(&host_id)?;
    let mut settings = SettingsService::load()?;
    settings.hosts.retain(|h| h.id != uuid);
    SettingsService::save(&settings)?;
    crate::core::vault_sync::schedule_auto_sync();
    Ok(())
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
            sftp_host_key_fingerprint: None,
            is_connected: false,
        };
        settings.hosts.push(host);
    }
    SettingsService::save(&settings)?;
    crate::core::vault_sync::schedule_auto_sync();
    Ok(())
}
