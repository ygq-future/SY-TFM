//! 跨设备保险库编排：本机设备加密、便携 Vault 与 WebDAV Adapter 之间的边界。

use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex as StdMutex, OnceLock};

use base64::Engine;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::crypto::key_storage;
use crate::crypto::portable_vault::{
    unlock_vault_key, validate_backup_password, wrap_vault_key, PortableVaultDocument, VaultKey,
};
use crate::crypto::secret_protector::{SecretProtector, ENCRYPTED_PREFIX};
use crate::enums::app_directory::AppDirectory;
use crate::enums::vault_policy::VaultPolicy;
use crate::enums::vault_resource::VaultResource;
use crate::enums::{ErrorCode, Platform, Protocol, VaultSyncPhase};
use crate::error::AppError;
use crate::models::{
    AppSettings, RemoteHost, VaultSyncSettings, VaultSyncStatus, VaultWebDavCredentials,
};
use crate::storage::SettingsService;
use crate::transport::{create_adapter, FileTransport, ProgressEvent};

static VAULT_SYNC_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static PENDING_AUTO_SYNC: OnceLock<StdMutex<Option<tauri::async_runtime::JoinHandle<()>>>> =
    OnceLock::new();

/// 保险库中加密保存的跨设备设置载荷。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableVaultPayload {
    schema_version: u32,
    settings: AppSettings,
    #[serde(default)]
    background_image: Option<PortableBackgroundImage>,
}

/// 云端保险库载荷：主机跨平台共享，其余设置按原生平台隔离。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudVaultPayload {
    schema_version: u32,
    #[serde(default)]
    hosts: Vec<RemoteHost>,
    #[serde(default)]
    platforms: Vec<CloudPlatformPayload>,
}

/// 单个平台拥有的应用设置与背景图片。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudPlatformPayload {
    platform: Platform,
    settings: AppSettings,
    #[serde(default)]
    host_settings: Vec<CloudPlatformHostSettings>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    background_asset: Option<CloudBackgroundAsset>,
    /// schema v2 兼容字段；下一次同步会迁移到独立压缩资源。
    #[serde(default)]
    background_image: Option<PortableBackgroundImage>,
}

/// 云端平台背景压缩包的非敏感索引信息。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudBackgroundAsset {
    file_name: String,
    remote_file: String,
    sha256: String,
    uncompressed_size: u64,
}

/// 一次同步中可能需要上传的背景资源原始字节。
struct PreparedBackgroundAsset {
    metadata: CloudBackgroundAsset,
    bytes: Vec<u8>,
}

/// 生成的云端配置以及与其引用相匹配的平台资源。
struct PreparedCloudPayload {
    payload: CloudVaultPayload,
    background_assets: Vec<PreparedBackgroundAsset>,
}

/// 主机中只属于本地平台的覆盖项。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudPlatformHostSettings {
    host_id: Uuid,
    #[serde(default)]
    download_path: Option<String>,
}

/// 用于增量同步比较的当前平台视图；其他平台条目不参与指纹。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudComparisonScope<'a> {
    hosts: &'a [RemoteHost],
    platform: Option<&'a CloudPlatformPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultPayloadHeader {
    schema_version: u32,
}

/// 随保险库加密保存的本地背景图片。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableBackgroundImage {
    file_name: String,
    data_base64: String,
}

/// 临时加密文件清理守卫。
struct EncryptedTempFile(PathBuf);

impl Drop for EncryptedTempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// 获取设置页可展示的同步状态。
pub fn status() -> Result<VaultSyncStatus, AppError> {
    let settings = SettingsService::load()?;
    let sync = settings.vault_sync;
    let password_saved = locally_protected_secret_is_readable(&sync.password)?;
    let backup_password_saved = locally_protected_secret_is_readable(&sync.backup_password)?;
    Ok(VaultSyncStatus {
        configured: !sync.webdav_url.is_empty() && !sync.username.is_empty() && password_saved,
        enabled: sync.enabled,
        phase: resolved_sync_phase(VaultSyncPhase::Idle, sync.sync_pending),
        vault_initialized: !sync.vault_id.is_empty() && sync.key_envelope.is_some(),
        password_saved,
        backup_password_saved,
        webdav_url: sync.webdav_url,
        username: sync.username,
        remote_path: cloud_file_path(),
        revision: sync.last_synced_revision,
        last_synced_at: sync.last_synced_at,
        unlocked_on_device: key_storage::get_vault_key()?.is_some(),
        refresh_interval_ms: VaultPolicy::StatusRefreshMilliseconds.value(),
    })
}

const fn resolved_sync_phase(runtime_phase: VaultSyncPhase, sync_pending: bool) -> VaultSyncPhase {
    if matches!(runtime_phase, VaultSyncPhase::Idle) && sync_pending {
        VaultSyncPhase::Pending
    } else {
        runtime_phase
    }
}

/// 将一次共享主机变化持久标记为待同步。
pub fn mark_host_sync_pending(settings: &mut AppSettings) {
    if !settings.vault_sync.enabled {
        return;
    }
    settings.vault_sync.sync_pending = true;
    settings.vault_sync.sync_change_generation =
        settings.vault_sync.sync_change_generation.saturating_add(1);
}

fn locally_protected_secret_is_readable(value: &str) -> Result<bool, AppError> {
    if value.is_empty() {
        return Ok(false);
    }
    if !value.starts_with(ENCRYPTED_PREFIX) {
        return Ok(true);
    }
    let key = key_storage::get_or_create_master_key()?;
    Ok(SecretProtector::new(key).decrypt(value).is_ok())
}

/// 在主机连续变化停止后执行一次双向同步；后来的调用会替换尚未执行的任务。
pub fn schedule_auto_sync() {
    let enabled = SettingsService::load()
        .map(|settings| settings.vault_sync.enabled)
        .unwrap_or(false);
    if !enabled {
        return;
    }
    let pending = PENDING_AUTO_SYNC.get_or_init(|| StdMutex::new(None));
    let Ok(mut slot) = pending.lock() else {
        return;
    };
    if let Some(handle) = slot.take() {
        handle.abort();
    }
    *slot = Some(tauri::async_runtime::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(
            VaultPolicy::AutoSyncDebounceMilliseconds.value() as u64,
        ))
        .await;
        let _ = sync_now(None).await;
    }));
}

fn cancel_auto_sync() {
    let Some(pending) = PENDING_AUTO_SYNC.get() else {
        return;
    };
    if let Ok(mut slot) = pending.lock() {
        if let Some(handle) = slot.take() {
            handle.abort();
        }
    }
}

/// 首次创建跨设备保险库并上传到固定 WebDAV 目录。
pub async fn enable(
    credentials: VaultWebDavCredentials,
    backup_password: Option<String>,
    overwrite_existing: bool,
) -> Result<VaultSyncStatus, AppError> {
    cancel_auto_sync();
    let _guard = sync_lock().lock().await;
    let current = SettingsService::load()?;
    let credentials = resolve_credentials_input(credentials, &current.vault_sync)?;
    let backup_password = resolve_backup_password(backup_password.as_deref(), &current.vault_sync)?;
    let mut adapter = connect_webdav(&credentials).await?;
    ensure_cloud_directory(adapter.as_mut()).await?;
    if remote_vault_exists(adapter.as_mut()).await? && !overwrite_existing {
        let _ = adapter.disconnect().await;
        return Err(AppError::new(
            ErrorCode::SyncConflict,
            "WebDAV 的 SY-TFM 目录中已经存在保险库，请使用“从云端恢复”",
        ));
    }

    let settings = SettingsService::load()?;
    let prepared = build_cloud_payload_for_platform(settings, None, current_platform())?;
    let scope_hash = cloud_scope_hash(&prepared.payload, current_platform())?;
    let hosts_hash = cloud_hosts_hash(&prepared.payload)?;
    let hosts_snapshot = protect_hosts_snapshot(&prepared.payload.hosts)?;
    let platform_hash = cloud_platform_hash(&prepared.payload, current_platform())?;
    let plaintext = serde_json::to_vec(&prepared.payload).map_err(invalid_backup_error)?;
    let vault_id = Uuid::new_v4().to_string();
    let (document, key) =
        PortableVaultDocument::create(&plaintext, &backup_password, vault_id.clone(), 1)?;
    upload_background_assets(adapter.as_mut(), &prepared.background_assets, &[]).await?;
    upload_document(adapter.as_mut(), &document).await?;
    let _ = adapter.disconnect().await;

    key_storage::store_vault_key(&key)?;
    let mut settings = SettingsService::load()?;
    settings.vault_sync = VaultSyncSettings {
        enabled: true,
        webdav_url: credentials.webdav_url,
        username: credentials.username,
        password: credentials.password,
        backup_password,
        vault_id,
        key_envelope: Some(document.key_envelope),
        last_synced_revision: document.revision,
        last_synced_at: Some(document.updated_at),
        last_synced_scope_hash: scope_hash,
        last_synced_hosts_hash: hosts_hash,
        last_synced_hosts_snapshot: hosts_snapshot,
        last_synced_platform_hash: platform_hash,
        sync_pending: false,
        sync_change_generation: 0,
    };
    SettingsService::save(&settings)?;
    status()
}

/// 验证并保存 WebDAV 地址、凭据和可选的共用备份密码，不创建目录或上传数据。
pub async fn test_and_save(
    credentials: VaultWebDavCredentials,
    backup_password: Option<String>,
) -> Result<VaultSyncStatus, AppError> {
    let mut settings = SettingsService::load()?;
    let credentials = resolve_credentials_input(credentials, &settings.vault_sync)?;
    let adapter = connect_webdav(&credentials).await?;
    adapter.disconnect().await?;
    settings.vault_sync.webdav_url = credentials.webdav_url;
    settings.vault_sync.username = credentials.username;
    settings.vault_sync.password = credentials.password;
    if let Some(password) = backup_password.filter(|password| !password.is_empty()) {
        settings.vault_sync.backup_password = password;
    }
    SettingsService::save(&settings)?;
    status()
}

/// 校验并保存共用备份密码；既有云端保险库仅在下次同步时切换到新密码。
pub async fn save_backup_password(
    password: String,
    confirmation: String,
) -> Result<VaultSyncStatus, AppError> {
    cancel_auto_sync();
    let _guard = sync_lock().lock().await;
    if password != confirmation {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "两次输入的备份密码不一致",
        ));
    }
    validate_backup_password(&password)?;
    let mut settings = SettingsService::load()?;
    let sync = settings.vault_sync.clone();

    if sync.key_envelope.is_some() && sync.vault_id.is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "本机保险库缺少 Vault ID",
        ));
    }
    if let Some(envelope) = sync.key_envelope.as_ref() {
        let key = match key_storage::get_vault_key()? {
            Some(key) => key,
            None => {
                let old_password = resolve_backup_password(None, &sync)?;
                unlock_vault_key(envelope, &old_password, &sync.vault_id)?
            }
        };
        settings.vault_sync.key_envelope = Some(wrap_vault_key(&key, &password, &sync.vault_id)?);
        key_storage::store_vault_key(&key)?;
    }

    settings.vault_sync.backup_password = password;
    SettingsService::save(&settings)?;
    status()
}

/// 双向比较共享主机与当前平台分区，仅对实际变化上传 revision，并拉取其他设备变更。
pub async fn sync_now(backup_password: Option<String>) -> Result<VaultSyncStatus, AppError> {
    let _guard = sync_lock().lock().await;
    let settings = SettingsService::load()?;
    let sync = settings.vault_sync.clone();
    if !sync.enabled {
        return Err(AppError::new(
            ErrorCode::VaultLocked,
            "跨设备保险库尚未启用",
        ));
    }
    let envelope = sync
        .key_envelope
        .clone()
        .ok_or_else(|| AppError::new(ErrorCode::InvalidBackup, "本机缺少保险库密钥信封"))?;
    let credentials = credentials_from_settings(&sync)?;
    let key = resolve_vault_key(backup_password.as_deref(), &sync)?;
    let mut adapter = connect_webdav(&credentials).await?;
    ensure_cloud_directory(adapter.as_mut()).await?;

    let remote_state = if let Some(remote) = download_remote_document(adapter.as_mut()).await? {
        if remote.vault_id != sync.vault_id {
            let _ = adapter.disconnect().await;
            return Err(AppError::new(
                ErrorCode::SyncConflict,
                "云端保险库与本机 Vault ID 不一致，请先从云端恢复",
            ));
        }
        let plaintext = remote.decrypt_with_key(&key)?;
        let payload = parse_cloud_payload(&plaintext)?;
        Some((remote, payload))
    } else {
        None
    };

    let remote_checkpoint = remote_state
        .as_ref()
        .map(|(document, _)| (document.revision, document.updated_at.clone()));
    let existing_payload = remote_state.as_ref().map(|(_, payload)| payload.clone());
    let existing_assets = existing_payload
        .as_ref()
        .map(cloud_background_asset_index)
        .unwrap_or_default();
    let prepared = build_cloud_payload_for_platform(
        settings.clone(),
        existing_payload.clone(),
        current_platform(),
    )?;
    let desired_scope_hash = cloud_scope_hash(&prepared.payload, current_platform())?;
    let desired_hosts_hash = cloud_hosts_hash(&prepared.payload)?;
    let desired_platform_hash = cloud_platform_hash(&prepared.payload, current_platform())?;

    let (mut final_payload, pull_hosts, pull_platform, push_hosts, push_platform) =
        if let Some(remote_payload) = existing_payload {
            let remote_scope_hash = cloud_scope_hash(&remote_payload, current_platform())?;
            let remote_hosts_hash = cloud_hosts_hash(&remote_payload)?;
            let remote_platform_hash = cloud_platform_hash(&remote_payload, current_platform())?;
            let (_, last_platform_hash) = resolve_last_component_hashes(
                &sync,
                &desired_scope_hash,
                &desired_hosts_hash,
                &desired_platform_hash,
                &remote_scope_hash,
                &remote_hosts_hash,
                &remote_platform_hash,
            );
            let base_hosts = if let Some(snapshot) = resolve_hosts_snapshot(&sync)? {
                snapshot
            } else if !sync.last_synced_hosts_hash.is_empty()
                && desired_hosts_hash == sync.last_synced_hosts_hash
            {
                prepared.payload.hosts.clone()
            } else if !sync.last_synced_hosts_hash.is_empty()
                && remote_hosts_hash == sync.last_synced_hosts_hash
            {
                remote_payload.hosts.clone()
            } else if desired_hosts_hash == remote_hosts_hash {
                prepared.payload.hosts.clone()
            } else {
                let _ = adapter.disconnect().await;
                return Err(AppError::new(
                    ErrorCode::SyncConflict,
                    "缺少共享主机的同步基线，无法安全合并两端变化",
                ));
            };
            let merged_hosts =
                merge_hosts_three_way(&base_hosts, &prepared.payload.hosts, &remote_payload.hosts)
                    .map_err(|conflict| {
                        let (kind, id) = match conflict {
                            HostMergeError::ConcurrentEdit(id) => ("编辑", id),
                            HostMergeError::ConcurrentAdd(id) => ("新增", id),
                        };
                        AppError::new(
                            ErrorCode::SyncConflict,
                            format!("主机 {id} 在两端发生了不兼容的并发{kind}"),
                        )
                    })?;
            let pull_hosts = merged_hosts != prepared.payload.hosts;
            let push_hosts = merged_hosts != remote_payload.hosts;
            let Some((pull_platform, push_platform)) = classify_scope_change(
                &desired_platform_hash,
                &remote_platform_hash,
                &last_platform_hash,
            ) else {
                let _ = adapter.disconnect().await;
                return Err(AppError::new(
                    ErrorCode::SyncConflict,
                    "当前平台设置已在本机和云端同时变化，请先确认要保留的版本",
                ));
            };
            let mut final_payload = remote_payload;
            final_payload.hosts = merged_hosts;
            if push_platform {
                replace_platform_payload(&mut final_payload, &prepared.payload, current_platform());
            }
            (
                final_payload,
                pull_hosts,
                pull_platform,
                push_hosts,
                push_platform,
            )
        } else {
            (prepared.payload.clone(), false, false, true, true)
        };

    final_payload.schema_version = VaultPolicy::CloudPayloadSchemaVersion.value();
    let final_scope_hash = cloud_scope_hash(&final_payload, current_platform())?;
    let final_hosts_hash = cloud_hosts_hash(&final_payload)?;
    let final_platform_hash = cloud_platform_hash(&final_payload, current_platform())?;
    let should_upload = push_hosts || push_platform;

    if !should_upload {
        let Some((remote_revision, remote_updated_at)) = remote_checkpoint else {
            let _ = adapter.disconnect().await;
            return Err(AppError::new(
                ErrorCode::SyncConflict,
                "云端保险库检查点缺失",
            ));
        };
        let result = if pull_hosts || pull_platform {
            apply_remote_scope(
                adapter.as_mut(),
                &settings,
                final_payload,
                pull_platform,
                remote_revision,
                remote_updated_at,
                final_scope_hash,
                final_hosts_hash,
                final_platform_hash,
            )
            .await
        } else {
            save_sync_checkpoint(
                &sync.vault_id,
                remote_revision,
                remote_updated_at,
                final_scope_hash,
                final_hosts_hash,
                final_platform_hash,
                &final_payload.hosts,
            )
        };
        let _ = adapter.disconnect().await;
        return result;
    }

    let assets_to_upload = if push_platform {
        prepared.background_assets.as_slice()
    } else {
        &[]
    };
    upload_background_assets(adapter.as_mut(), assets_to_upload, &existing_assets).await?;
    let plaintext = serde_json::to_vec(&final_payload).map_err(invalid_backup_error)?;
    let remote_revision = remote_checkpoint
        .as_ref()
        .map(|(revision, _)| *revision)
        .unwrap_or(0);
    let revision = sync
        .last_synced_revision
        .max(remote_revision)
        .saturating_add(1);
    let document =
        PortableVaultDocument::encrypt(&plaintext, key, sync.vault_id.clone(), revision, envelope)?;
    upload_document(adapter.as_mut(), &document).await?;
    cleanup_stale_background_assets(adapter.as_mut(), &existing_assets, &final_payload).await;
    let result = if pull_hosts || pull_platform {
        apply_remote_scope(
            adapter.as_mut(),
            &settings,
            final_payload,
            pull_platform,
            revision,
            document.updated_at,
            final_scope_hash,
            final_hosts_hash,
            final_platform_hash,
        )
        .await
    } else {
        save_sync_checkpoint(
            &sync.vault_id,
            revision,
            document.updated_at,
            final_scope_hash,
            final_hosts_hash,
            final_platform_hash,
            &final_payload.hosts,
        )
    };
    let _ = adapter.disconnect().await;
    result
}

/// 从 WebDAV 下载保险库并使用备份密码恢复到当前设备。
pub async fn restore(
    credentials: VaultWebDavCredentials,
    backup_password: Option<String>,
) -> Result<AppSettings, AppError> {
    cancel_auto_sync();
    let _guard = sync_lock().lock().await;
    let current = SettingsService::load()?;
    let credentials = resolve_credentials_input(credentials, &current.vault_sync)?;
    let backup_password = resolve_backup_password(backup_password.as_deref(), &current.vault_sync)?;
    let mut adapter = connect_webdav(&credentials).await?;
    ensure_cloud_directory(adapter.as_mut()).await?;
    let document = download_remote_document(adapter.as_mut())
        .await?
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::FileNotFound,
                format!("云端未找到 {}", cloud_file_path()),
            )
        })?;
    let (plaintext, key) = document.decrypt_with_password(&backup_password)?;
    let payload = parse_cloud_payload(&plaintext)?;
    let scope_hash = cloud_scope_hash(&payload, current_platform())?;
    let hosts_hash = cloud_hosts_hash(&payload)?;
    let hosts_snapshot = protect_hosts_snapshot(&payload.hosts)?;
    let platform_hash = cloud_platform_hash(&payload, current_platform())?;
    let (mut restored, background_image, background_asset) =
        restore_cloud_settings_for_platform(payload, current_platform());
    if let Some(asset) = background_asset {
        restore_cloud_background_asset(adapter.as_mut(), &mut restored, &asset, current_platform())
            .await?;
    } else {
        restore_background_image(&mut restored, background_image)?;
    }
    let _ = adapter.disconnect().await;
    restored.vault_sync = VaultSyncSettings {
        enabled: false,
        webdav_url: credentials.webdav_url,
        username: credentials.username,
        password: credentials.password,
        backup_password: backup_password.clone(),
        vault_id: document.vault_id,
        key_envelope: Some(document.key_envelope),
        last_synced_revision: document.revision,
        last_synced_at: Some(document.updated_at),
        last_synced_scope_hash: scope_hash,
        last_synced_hosts_hash: hosts_hash,
        last_synced_hosts_snapshot: hosts_snapshot,
        last_synced_platform_hash: platform_hash,
        sync_pending: false,
        sync_change_generation: 0,
    };
    key_storage::store_vault_key(&key)?;
    SettingsService::save(&restored)?;
    SettingsService::load()
}

/// 暂停自动同步；保留本机凭据、共用备份密码、Vault Key 与云端文件。
pub async fn pause() -> Result<VaultSyncStatus, AppError> {
    cancel_auto_sync();
    let _guard = sync_lock().lock().await;
    let mut settings = SettingsService::load()?;
    pause_settings(&mut settings);
    SettingsService::save(&settings)?;
    status()
}

/// 恢复已初始化保险库的自动同步，并立即双向核对当前配置。
pub async fn resume() -> Result<VaultSyncStatus, AppError> {
    let mut settings = SettingsService::load()?;
    if settings.vault_sync.vault_id.is_empty() || settings.vault_sync.key_envelope.is_none() {
        return Err(AppError::new(
            ErrorCode::VaultLocked,
            "尚未创建或恢复云端保险库",
        ));
    }
    settings.vault_sync.enabled = true;
    SettingsService::save(&settings)?;
    sync_now(None).await
}

/// 导出由用户备份密码保护的本地便携保险库文件。
pub fn export_file(file_path: String, backup_password: Option<String>) -> Result<(), AppError> {
    let mut settings = SettingsService::load()?;
    let backup_password =
        resolve_backup_password(backup_password.as_deref(), &settings.vault_sync)?;
    let payload = build_portable_payload(settings.clone())?;
    let plaintext = serde_json::to_vec(&payload).map_err(invalid_backup_error)?;
    let (document, _) =
        PortableVaultDocument::create(&plaintext, &backup_password, Uuid::new_v4().to_string(), 1)?;
    let serialized = serde_json::to_vec(&document).map_err(invalid_backup_error)?;
    crate::local_fs::atomic_write(Path::new(&file_path), &serialized)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    settings.vault_sync.backup_password = backup_password;
    SettingsService::save(&settings)
}

/// 从本地便携保险库文件恢复，并使用当前设备主密钥重新保护密码。
pub fn import_file(
    file_path: String,
    backup_password: Option<String>,
) -> Result<AppSettings, AppError> {
    let current = SettingsService::load()?;
    let backup_password = resolve_backup_password(backup_password.as_deref(), &current.vault_sync)?;
    let path = Path::new(&file_path);
    let metadata = std::fs::metadata(path)
        .map_err(|error| AppError::new(ErrorCode::StorageReadFailed, error.to_string()))?;
    if metadata.len() > VaultPolicy::MaximumFileBytes.value() as u64 {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "保险库文件超过 32 MiB 安全限制",
        ));
    }
    let serialized = std::fs::read(path)
        .map_err(|error| AppError::new(ErrorCode::StorageReadFailed, error.to_string()))?;
    let document: PortableVaultDocument =
        serde_json::from_slice(&serialized).map_err(invalid_backup_error)?;
    let (plaintext, _) = document.decrypt_with_password(&backup_password)?;
    let payload: PortableVaultPayload =
        serde_json::from_slice(&plaintext).map_err(invalid_backup_error)?;
    let mut restored = payload.settings;
    restore_background_image(&mut restored, payload.background_image)?;
    restored.vault_sync = current.vault_sync;
    restored.vault_sync.backup_password = backup_password;
    SettingsService::save(&restored)?;
    SettingsService::load()
}

fn sync_lock() -> &'static Mutex<()> {
    VAULT_SYNC_LOCK.get_or_init(|| Mutex::new(()))
}

fn pause_settings(settings: &mut AppSettings) {
    settings.vault_sync.enabled = false;
}

fn build_portable_payload(mut settings: AppSettings) -> Result<PortableVaultPayload, AppError> {
    decrypt_host_passwords(&mut settings)?;
    let background_image = capture_background_image(&settings)?;
    settings.vault_sync = VaultSyncSettings::default();
    Ok(PortableVaultPayload {
        schema_version: VaultPolicy::PortablePayloadSchemaVersion.value(),
        settings,
        background_image,
    })
}

fn build_cloud_payload_for_platform(
    mut settings: AppSettings,
    existing: Option<CloudVaultPayload>,
    platform: Platform,
) -> Result<PreparedCloudPayload, AppError> {
    decrypt_host_passwords(&mut settings)?;
    let current_background = capture_cloud_background_asset(&settings, platform)?;
    let mut host_settings = settings
        .hosts
        .iter()
        .filter_map(|host| {
            host.download_path
                .clone()
                .map(|download_path| CloudPlatformHostSettings {
                    host_id: host.id,
                    download_path: Some(download_path),
                })
        })
        .collect::<Vec<_>>();
    host_settings.sort_by_key(|entry| entry.host_id);
    for host in &mut settings.hosts {
        host.download_path = None;
    }
    let hosts = std::mem::take(&mut settings.hosts);
    settings.background_image_path = None;
    settings.vault_sync = VaultSyncSettings::default();

    let mut payload = existing.unwrap_or(CloudVaultPayload {
        schema_version: VaultPolicy::CloudPayloadSchemaVersion.value(),
        hosts: Vec::new(),
        platforms: Vec::new(),
    });
    let mut background_assets = migrate_legacy_cloud_backgrounds(&mut payload, platform)?;
    payload.schema_version = VaultPolicy::CloudPayloadSchemaVersion.value();
    payload.hosts = hosts;
    payload.platforms.retain(|entry| entry.platform != platform);
    let background_asset = current_background
        .as_ref()
        .map(|prepared| prepared.metadata.clone());
    if let Some(prepared) = current_background {
        background_assets.push(prepared);
    }
    payload.platforms.push(CloudPlatformPayload {
        platform,
        settings,
        host_settings,
        background_asset,
        background_image: None,
    });
    Ok(PreparedCloudPayload {
        payload,
        background_assets,
    })
}

fn restore_cloud_settings_for_platform(
    payload: CloudVaultPayload,
    platform: Platform,
) -> (
    AppSettings,
    Option<PortableBackgroundImage>,
    Option<CloudBackgroundAsset>,
) {
    let platform_payload = payload
        .platforms
        .into_iter()
        .find(|entry| entry.platform == platform);
    let (mut settings, host_settings, background_image, background_asset) = match platform_payload {
        Some(entry) => (
            entry.settings,
            entry.host_settings,
            entry.background_image,
            entry.background_asset,
        ),
        None => (AppSettings::default(), Vec::new(), None, None),
    };
    settings.hosts = payload
        .hosts
        .into_iter()
        .map(|mut host| {
            host.download_path = host_settings
                .iter()
                .find(|entry| entry.host_id == host.id)
                .and_then(|entry| entry.download_path.clone());
            host
        })
        .collect();
    settings.vault_sync = VaultSyncSettings::default();
    (settings, background_image, background_asset)
}

fn parse_cloud_payload(plaintext: &[u8]) -> Result<CloudVaultPayload, AppError> {
    let header: VaultPayloadHeader =
        serde_json::from_slice(plaintext).map_err(invalid_backup_error)?;
    if header.schema_version == VaultPolicy::CloudPayloadSchemaVersion.value()
        || header.schema_version == VaultPolicy::LegacyCloudPayloadSchemaVersion.value()
    {
        let mut payload: CloudVaultPayload =
            serde_json::from_slice(plaintext).map_err(invalid_backup_error)?;
        payload.schema_version = VaultPolicy::CloudPayloadSchemaVersion.value();
        return Ok(payload);
    }
    if header.schema_version == VaultPolicy::PortablePayloadSchemaVersion.value() {
        let legacy: PortableVaultPayload =
            serde_json::from_slice(plaintext).map_err(invalid_backup_error)?;
        let hosts = legacy
            .settings
            .hosts
            .into_iter()
            .map(|mut host| {
                host.download_path = None;
                host
            })
            .collect();
        return Ok(CloudVaultPayload {
            schema_version: VaultPolicy::CloudPayloadSchemaVersion.value(),
            hosts,
            platforms: Vec::new(),
        });
    }
    Err(AppError::new(
        ErrorCode::InvalidBackup,
        format!("不支持的保险库载荷版本: {}", header.schema_version),
    ))
}

fn capture_cloud_background_asset(
    settings: &AppSettings,
    platform: Platform,
) -> Result<Option<PreparedBackgroundAsset>, AppError> {
    let Some(raw_path) = settings.background_image_path.as_deref() else {
        return Ok(None);
    };
    if raw_path.starts_with("data:")
        || raw_path.starts_with("http://")
        || raw_path.starts_with("https://")
    {
        return Ok(None);
    }
    let path = Path::new(raw_path);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::new(ErrorCode::StorageReadFailed, "背景图片路径缺少有效文件名"))?;
    let bytes = std::fs::read(path).map_err(|error| {
        AppError::new(
            ErrorCode::StorageReadFailed,
            format!("无法读取要同步的背景图片 {}: {error}", path.display()),
        )
    })?;
    prepare_background_asset(platform, file_name.to_string(), bytes).map(Some)
}

fn prepare_background_asset(
    platform: Platform,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<PreparedBackgroundAsset, AppError> {
    if bytes.len() > VaultPolicy::MaximumBackgroundBytes.value() as usize {
        return Err(AppError::new(
            ErrorCode::StorageReadFailed,
            "背景图片超过 20 MiB 安全限制",
        ));
    }
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::new(ErrorCode::InvalidBackup, "背景图片名称无效"))?;
    let digest = Sha256::digest(&bytes);
    let sha256: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    Ok(PreparedBackgroundAsset {
        metadata: CloudBackgroundAsset {
            file_name: safe_name.to_string(),
            remote_file: background_asset_file_name(platform, &sha256),
            sha256,
            uncompressed_size: bytes.len() as u64,
        },
        bytes,
    })
}

fn migrate_legacy_cloud_backgrounds(
    payload: &mut CloudVaultPayload,
    current_platform: Platform,
) -> Result<Vec<PreparedBackgroundAsset>, AppError> {
    let mut prepared = Vec::new();
    for entry in &mut payload.platforms {
        if entry.platform == current_platform {
            continue;
        }
        let Some(legacy) = entry.background_image.take() else {
            continue;
        };
        if entry.background_asset.is_some() {
            continue;
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(legacy.data_base64)
            .map_err(invalid_backup_error)?;
        let asset = prepare_background_asset(entry.platform, legacy.file_name, bytes)?;
        entry.background_asset = Some(asset.metadata.clone());
        entry.settings.background_image_path = None;
        prepared.push(asset);
    }
    Ok(prepared)
}

fn cloud_background_asset_index(payload: &CloudVaultPayload) -> Vec<CloudBackgroundAsset> {
    payload
        .platforms
        .iter()
        .filter_map(|entry| entry.background_asset.clone())
        .collect()
}

fn background_asset_file_name(platform: Platform, sha256: &str) -> String {
    format!(
        "{}{}{}",
        background_asset_prefix(platform),
        sha256,
        VaultResource::BackgroundArchiveExtension.as_str()
    )
}

const fn background_asset_prefix(platform: Platform) -> &'static str {
    match platform {
        Platform::Windows => VaultResource::BackgroundWindowsPrefix.as_str(),
        Platform::Macos => VaultResource::BackgroundMacosPrefix.as_str(),
        Platform::Linux => VaultResource::BackgroundLinuxPrefix.as_str(),
        Platform::Ios => VaultResource::BackgroundIosPrefix.as_str(),
        Platform::Android => VaultResource::BackgroundAndroidPrefix.as_str(),
    }
}

fn cloud_scope_hash(payload: &CloudVaultPayload, platform: Platform) -> Result<String, AppError> {
    let platform_payload = canonical_platform_payload(payload, platform);
    let scope = CloudComparisonScope {
        hosts: &payload.hosts,
        platform: platform_payload.as_ref(),
    };
    let serialized = serde_json::to_vec(&scope).map_err(invalid_backup_error)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(serialized)))
}

fn cloud_hosts_hash(payload: &CloudVaultPayload) -> Result<String, AppError> {
    cloud_hosts_slice_hash(&payload.hosts)
}

fn cloud_hosts_slice_hash(hosts: &[RemoteHost]) -> Result<String, AppError> {
    let serialized = serde_json::to_vec(hosts).map_err(invalid_backup_error)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(serialized)))
}

fn canonical_cloud_hosts(settings: &AppSettings) -> Result<Vec<RemoteHost>, AppError> {
    let key = key_storage::get_or_create_master_key()?;
    let protector = SecretProtector::new(key);
    settings
        .hosts
        .iter()
        .cloned()
        .map(|mut host| {
            if host.password.starts_with(ENCRYPTED_PREFIX) {
                host.password = protector.decrypt(&host.password)?;
            }
            host.download_path = None;
            host.is_connected = false;
            Ok(host)
        })
        .collect()
}

fn protect_hosts_snapshot(hosts: &[RemoteHost]) -> Result<String, AppError> {
    let serialized = serde_json::to_string(hosts).map_err(invalid_backup_error)?;
    let key = key_storage::get_or_create_master_key()?;
    SecretProtector::new(key).encrypt(&serialized)
}

fn resolve_hosts_snapshot(sync: &VaultSyncSettings) -> Result<Option<Vec<RemoteHost>>, AppError> {
    if sync.last_synced_hosts_snapshot.is_empty() {
        return Ok(None);
    }
    let key = key_storage::get_or_create_master_key()?;
    let serialized = SecretProtector::new(key).decrypt(&sync.last_synced_hosts_snapshot)?;
    serde_json::from_str(&serialized)
        .map(Some)
        .map_err(invalid_backup_error)
}

/// 在主机写入前迁移旧版哈希检查点，避免升级后的第一次离线修改丢失三方合并基线。
pub fn capture_host_sync_baseline(settings: &mut AppSettings) -> Result<(), AppError> {
    if !settings.vault_sync.enabled
        || !settings.vault_sync.last_synced_hosts_snapshot.is_empty()
        || settings.vault_sync.last_synced_hosts_hash.is_empty()
    {
        return Ok(());
    }
    let hosts = canonical_cloud_hosts(settings)?;
    if cloud_hosts_slice_hash(&hosts)? == settings.vault_sync.last_synced_hosts_hash {
        settings.vault_sync.last_synced_hosts_snapshot = protect_hosts_snapshot(&hosts)?;
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HostMergeError {
    ConcurrentEdit(Uuid),
    ConcurrentAdd(Uuid),
}

fn merge_host_record(
    id: Uuid,
    base: Option<&RemoteHost>,
    local: Option<&RemoteHost>,
    remote: Option<&RemoteHost>,
) -> Result<Option<RemoteHost>, HostMergeError> {
    match (base, local, remote) {
        (None, None, None) | (Some(_), None, None) => Ok(None),
        (None, Some(host), None) | (None, None, Some(host)) => Ok(Some(host.clone())),
        (None, Some(local), Some(remote)) if local == remote => Ok(Some(local.clone())),
        (None, Some(_), Some(_)) => Err(HostMergeError::ConcurrentAdd(id)),
        // 删除优先于同一条记录上的并发编辑，防止已删除主机被离线设备复活。
        (Some(_), None, Some(_)) | (Some(_), Some(_), None) => Ok(None),
        (Some(_), Some(local), Some(remote)) if local == remote => Ok(Some(local.clone())),
        (Some(base), Some(local), Some(remote)) if local == base => Ok(Some(remote.clone())),
        (Some(base), Some(local), Some(remote)) if remote == base => Ok(Some(local.clone())),
        (Some(_), Some(_), Some(_)) => Err(HostMergeError::ConcurrentEdit(id)),
    }
}

fn merge_hosts_three_way(
    base: &[RemoteHost],
    local: &[RemoteHost],
    remote: &[RemoteHost],
) -> Result<Vec<RemoteHost>, HostMergeError> {
    let base_by_id: HashMap<Uuid, &RemoteHost> = base.iter().map(|host| (host.id, host)).collect();
    let local_by_id: HashMap<Uuid, &RemoteHost> =
        local.iter().map(|host| (host.id, host)).collect();
    let remote_by_id: HashMap<Uuid, &RemoteHost> =
        remote.iter().map(|host| (host.id, host)).collect();
    let ids: HashSet<Uuid> = base_by_id
        .keys()
        .chain(local_by_id.keys())
        .chain(remote_by_id.keys())
        .copied()
        .collect();
    let mut merged_by_id = HashMap::new();
    for id in ids {
        if let Some(host) = merge_host_record(
            id,
            base_by_id.get(&id).copied(),
            local_by_id.get(&id).copied(),
            remote_by_id.get(&id).copied(),
        )? {
            merged_by_id.insert(id, host);
        }
    }

    let surviving: HashSet<Uuid> = merged_by_id.keys().copied().collect();
    let filtered_ids = |hosts: &[RemoteHost]| {
        hosts
            .iter()
            .map(|host| host.id)
            .filter(|id| surviving.contains(id))
            .collect::<Vec<_>>()
    };
    let base_order = filtered_ids(base);
    let local_order = filtered_ids(local);
    let remote_order = filtered_ids(remote);
    let mut order = if local_order == remote_order {
        local_order
    } else if local_order == base_order {
        remote_order
    } else if remote_order == base_order {
        local_order
    } else {
        let mut combined = remote_order;
        for id in local_order {
            if !combined.contains(&id) {
                combined.push(id);
            }
        }
        combined
    };
    for id in surviving {
        if !order.contains(&id) {
            order.push(id);
        }
    }
    Ok(order
        .into_iter()
        .filter_map(|id| merged_by_id.remove(&id))
        .collect())
}

fn cloud_platform_hash(
    payload: &CloudVaultPayload,
    platform: Platform,
) -> Result<String, AppError> {
    let platform_payload = canonical_platform_payload(payload, platform);
    let serialized = serde_json::to_vec(&platform_payload).map_err(invalid_backup_error)?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(serialized)))
}

fn canonical_platform_payload(
    payload: &CloudVaultPayload,
    platform: Platform,
) -> Option<CloudPlatformPayload> {
    let host_ids = payload
        .hosts
        .iter()
        .map(|host| host.id)
        .collect::<HashSet<_>>();
    let mut platform_payload = payload
        .platforms
        .iter()
        .find(|entry| entry.platform == platform)
        .cloned()?;
    platform_payload
        .host_settings
        .retain(|entry| entry.download_path.is_some() && host_ids.contains(&entry.host_id));
    platform_payload
        .host_settings
        .sort_by_key(|entry| entry.host_id);
    Some(platform_payload)
}

fn resolve_last_component_hashes(
    sync: &VaultSyncSettings,
    desired_scope_hash: &str,
    desired_hosts_hash: &str,
    desired_platform_hash: &str,
    remote_scope_hash: &str,
    remote_hosts_hash: &str,
    remote_platform_hash: &str,
) -> (String, String) {
    if !sync.last_synced_hosts_hash.is_empty() && !sync.last_synced_platform_hash.is_empty() {
        return (
            sync.last_synced_hosts_hash.clone(),
            sync.last_synced_platform_hash.clone(),
        );
    }
    if sync.last_synced_scope_hash == desired_scope_hash {
        return (
            desired_hosts_hash.to_string(),
            desired_platform_hash.to_string(),
        );
    }
    if sync.last_synced_scope_hash == remote_scope_hash {
        return (
            remote_hosts_hash.to_string(),
            remote_platform_hash.to_string(),
        );
    }
    (String::new(), String::new())
}

/// 返回 `(pull_remote, push_local)`；`None` 表示两端对同一作用域并发修改。
fn classify_scope_change(
    local_hash: &str,
    remote_hash: &str,
    last_hash: &str,
) -> Option<(bool, bool)> {
    if local_hash == remote_hash {
        return Some((false, false));
    }
    if !last_hash.is_empty() && local_hash == last_hash {
        return Some((true, false));
    }
    if !last_hash.is_empty() && remote_hash == last_hash {
        return Some((false, true));
    }
    None
}

fn replace_platform_payload(
    target: &mut CloudVaultPayload,
    source: &CloudVaultPayload,
    platform: Platform,
) {
    target.platforms.retain(|entry| entry.platform != platform);
    if let Some(entry) = source
        .platforms
        .iter()
        .find(|entry| entry.platform == platform)
    {
        target.platforms.push(entry.clone());
    }
}

fn save_sync_checkpoint(
    vault_id: &str,
    revision: u64,
    updated_at: String,
    scope_hash: String,
    hosts_hash: String,
    platform_hash: String,
    hosts: &[RemoteHost],
) -> Result<VaultSyncStatus, AppError> {
    let mut latest = SettingsService::load()?;
    if latest.vault_sync.vault_id != vault_id {
        return Err(AppError::new(
            ErrorCode::SyncConflict,
            "同步期间本机保险库配置已变化",
        ));
    }
    latest.vault_sync.last_synced_revision = revision;
    latest.vault_sync.last_synced_at = Some(updated_at);
    latest.vault_sync.last_synced_scope_hash = scope_hash;
    latest.vault_sync.last_synced_hosts_hash = hosts_hash;
    latest.vault_sync.last_synced_hosts_snapshot = protect_hosts_snapshot(hosts)?;
    latest.vault_sync.last_synced_platform_hash = platform_hash;
    SettingsService::save(&latest)?;
    status()
}

#[allow(clippy::too_many_arguments)]
async fn apply_remote_scope(
    adapter: &mut dyn FileTransport,
    local: &AppSettings,
    payload: CloudVaultPayload,
    pull_platform: bool,
    revision: u64,
    updated_at: String,
    scope_hash: String,
    hosts_hash: String,
    platform_hash: String,
) -> Result<VaultSyncStatus, AppError> {
    let hosts_snapshot = protect_hosts_snapshot(&payload.hosts)?;
    let (mut merged, background_image, background_asset) =
        restore_cloud_settings_for_platform(payload, current_platform());
    if pull_platform {
        if let Some(asset) = background_asset {
            restore_cloud_background_asset(adapter, &mut merged, &asset, current_platform())
                .await?;
        } else {
            restore_background_image(&mut merged, background_image)?;
        }
    } else {
        merged.background_image_path = local.background_image_path.clone();
    }
    merged.vault_sync = local.vault_sync.clone();
    merged.vault_sync.last_synced_revision = revision;
    merged.vault_sync.last_synced_at = Some(updated_at);
    merged.vault_sync.last_synced_scope_hash = scope_hash;
    merged.vault_sync.last_synced_hosts_hash = hosts_hash;
    merged.vault_sync.last_synced_hosts_snapshot = hosts_snapshot;
    merged.vault_sync.last_synced_platform_hash = platform_hash;
    SettingsService::save(&merged)?;
    status()
}

fn decrypt_host_passwords(settings: &mut AppSettings) -> Result<(), AppError> {
    let key = key_storage::get_or_create_master_key()?;
    let protector = SecretProtector::new(key);
    for host in &mut settings.hosts {
        if host.password.starts_with(ENCRYPTED_PREFIX) {
            host.password = protector.decrypt(&host.password)?;
        }
    }
    Ok(())
}

const fn current_platform() -> Platform {
    if cfg!(target_os = "windows") {
        Platform::Windows
    } else if cfg!(target_os = "macos") {
        Platform::Macos
    } else if cfg!(target_os = "linux") {
        Platform::Linux
    } else if cfg!(target_os = "ios") {
        Platform::Ios
    } else {
        Platform::Android
    }
}

fn capture_background_image(
    settings: &AppSettings,
) -> Result<Option<PortableBackgroundImage>, AppError> {
    let Some(raw_path) = settings.background_image_path.as_deref() else {
        return Ok(None);
    };
    if raw_path.starts_with("data:")
        || raw_path.starts_with("http://")
        || raw_path.starts_with("https://")
    {
        return Ok(None);
    }
    let path = Path::new(raw_path);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::new(ErrorCode::StorageReadFailed, "背景图片路径缺少有效文件名"))?;
    let bytes = std::fs::read(path).map_err(|error| {
        AppError::new(
            ErrorCode::StorageReadFailed,
            format!("无法读取要备份的背景图片 {}: {error}", path.display()),
        )
    })?;
    Ok(Some(PortableBackgroundImage {
        file_name: file_name.to_string(),
        data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    }))
}

fn restore_background_image(
    settings: &mut AppSettings,
    image: Option<PortableBackgroundImage>,
) -> Result<(), AppError> {
    let Some(image) = image else {
        return Ok(());
    };
    let safe_name = Path::new(&image.file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::new(ErrorCode::InvalidBackup, "保险库中的背景图片名称无效"))?;
    let directory =
        SettingsService::default_data_dir()?.join(AppDirectory::VaultBackgroundRoot.as_str());
    std::fs::create_dir_all(&directory)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    let path = directory.join(safe_name);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image.data_base64)
        .map_err(|error| AppError::new(ErrorCode::InvalidBackup, error.to_string()))?;
    crate::local_fs::atomic_write(&path, &bytes)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    settings.background_image_path = Some(path.to_string_lossy().into_owned());
    Ok(())
}

fn credentials_from_settings(sync: &VaultSyncSettings) -> Result<VaultWebDavCredentials, AppError> {
    let key = key_storage::get_or_create_master_key()?;
    let password = if sync.password.starts_with(ENCRYPTED_PREFIX) {
        SecretProtector::new(key).decrypt(&sync.password)?
    } else {
        sync.password.clone()
    };
    let credentials = VaultWebDavCredentials {
        webdav_url: sync.webdav_url.clone(),
        username: sync.username.clone(),
        password,
    };
    validate_credentials(&credentials)?;
    Ok(credentials)
}

fn resolve_credentials_input(
    mut credentials: VaultWebDavCredentials,
    sync: &VaultSyncSettings,
) -> Result<VaultWebDavCredentials, AppError> {
    if credentials.webdav_url.trim().is_empty() {
        credentials.webdav_url = sync.webdav_url.clone();
    }
    if credentials.username.trim().is_empty() {
        credentials.username = sync.username.clone();
    }
    if credentials.password.is_empty() {
        credentials.password = credentials_from_settings(sync)?.password;
    }
    validate_credentials(&credentials)?;
    Ok(credentials)
}

fn resolve_backup_password(
    input: Option<&str>,
    sync: &VaultSyncSettings,
) -> Result<String, AppError> {
    if let Some(password) = input.filter(|password| !password.is_empty()) {
        if password.chars().count() < VaultPolicy::MinimumPasswordCharacters.value() as usize {
            return Err(AppError::new(
                ErrorCode::InvalidBackup,
                "备份密码至少需要 8 个字符",
            ));
        }
        if let Some(envelope) = sync.key_envelope.as_ref() {
            if !sync.vault_id.is_empty() {
                unlock_vault_key(envelope, password, &sync.vault_id)?;
            }
        }
        return Ok(password.to_string());
    }
    if sync.backup_password.is_empty() {
        return Err(AppError::new(
            ErrorCode::VaultLocked,
            "请先输入并保存备份密码",
        ));
    }
    let key = key_storage::get_or_create_master_key()?;
    if sync.backup_password.starts_with(ENCRYPTED_PREFIX) {
        SecretProtector::new(key).decrypt(&sync.backup_password)
    } else {
        Ok(sync.backup_password.clone())
    }
}

fn resolve_vault_key(
    backup_password: Option<&str>,
    sync: &VaultSyncSettings,
) -> Result<VaultKey, AppError> {
    if let Some(key) = key_storage::get_vault_key()? {
        return Ok(key);
    }
    let backup_password = resolve_backup_password(backup_password, sync)?;
    let envelope = sync
        .key_envelope
        .clone()
        .ok_or_else(|| AppError::new(ErrorCode::InvalidBackup, "本机缺少保险库密钥信封"))?;
    let key = unlock_vault_key(&envelope, &backup_password, &sync.vault_id)?;
    key_storage::store_vault_key(&key)?;
    Ok(key)
}

fn validate_credentials(credentials: &VaultWebDavCredentials) -> Result<(), AppError> {
    if credentials.webdav_url.trim().is_empty()
        || credentials.username.trim().is_empty()
        || credentials.password.is_empty()
    {
        return Err(AppError::new(
            ErrorCode::AuthFailed,
            "WebDAV URL、用户名和密码不能为空",
        ));
    }
    Ok(())
}

async fn connect_webdav(
    credentials: &VaultWebDavCredentials,
) -> Result<Box<dyn FileTransport>, AppError> {
    let raw_url = credentials.webdav_url.trim();
    let host = RemoteHost {
        id: Uuid::new_v4(),
        name: VaultResource::CloudDirectory.as_str().to_string(),
        protocol: Protocol::WebDav,
        host: raw_url.to_string(),
        port: 0,
        username: credentials.username.clone(),
        password: String::new(),
        tags: String::new(),
        download_path: None,
        https: !raw_url.to_ascii_lowercase().starts_with("http://"),
        base_path: None,
        sftp_host_key_fingerprint: None,
        is_connected: false,
    };
    let mut adapter = create_adapter(Protocol::WebDav);
    adapter.connect(&host, Some(&credentials.password)).await?;
    Ok(adapter)
}

async fn ensure_cloud_directory(adapter: &mut dyn FileTransport) -> Result<(), AppError> {
    let entries = adapter.list_directory("/").await?;
    if entries
        .iter()
        .any(|entry| entry.is_directory && entry.name == VaultResource::CloudDirectory.as_str())
    {
        return Ok(());
    }
    adapter
        .create_directory(&format!("/{}", VaultResource::CloudDirectory.as_str()))
        .await
}

async fn remote_vault_exists(adapter: &mut dyn FileTransport) -> Result<bool, AppError> {
    let entries = adapter
        .list_directory(&format!("/{}", VaultResource::CloudDirectory.as_str()))
        .await?;
    Ok(entries
        .iter()
        .any(|entry| !entry.is_directory && entry.name == VaultResource::CloudFile.as_str()))
}

async fn upload_background_assets(
    adapter: &mut dyn FileTransport,
    prepared: &[PreparedBackgroundAsset],
    existing: &[CloudBackgroundAsset],
) -> Result<(), AppError> {
    if prepared.is_empty() {
        return Ok(());
    }
    let entries = adapter
        .list_directory(&format!("/{}", VaultResource::CloudDirectory.as_str()))
        .await?;
    for asset in prepared {
        let remote_exists = entries
            .iter()
            .any(|entry| !entry.is_directory && entry.name == asset.metadata.remote_file);
        if !background_asset_needs_upload(&asset.metadata, existing, remote_exists) {
            continue;
        }

        let temp = background_temp_path()?;
        let _cleanup = EncryptedTempFile(temp.clone());
        let file = std::fs::File::create(&temp)
            .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
        let mut encoder = GzEncoder::new(file, Compression::best());
        encoder
            .write_all(&asset.bytes)
            .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
        encoder
            .finish()
            .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;

        let (tx, mut rx) = tokio::sync::mpsc::channel(32);
        let drain = tokio::spawn(async move { while rx.recv().await.is_some() {} });
        let result = adapter
            .upload_file(
                &temp.to_string_lossy(),
                &cloud_resource_path(&asset.metadata.remote_file),
                tx,
            )
            .await;
        let _ = drain.await;
        result?;
    }
    Ok(())
}

fn background_asset_needs_upload(
    local: &CloudBackgroundAsset,
    existing: &[CloudBackgroundAsset],
    remote_exists: bool,
) -> bool {
    if !remote_exists {
        return true;
    }
    !existing.iter().any(|remote| {
        remote.remote_file == local.remote_file
            && remote.sha256 == local.sha256
            && remote.uncompressed_size == local.uncompressed_size
    })
}

async fn cleanup_stale_background_assets(
    adapter: &mut dyn FileTransport,
    existing: &[CloudBackgroundAsset],
    payload: &CloudVaultPayload,
) {
    let referenced: Vec<&str> = payload
        .platforms
        .iter()
        .filter_map(|entry| entry.background_asset.as_ref())
        .map(|asset| asset.remote_file.as_str())
        .collect();
    for stale in existing {
        if referenced.contains(&stale.remote_file.as_str())
            || !is_managed_background_asset_name(&stale.remote_file)
        {
            continue;
        }
        let _ = adapter
            .delete_file(&cloud_resource_path(&stale.remote_file))
            .await;
    }
}

fn is_managed_background_asset_name(file_name: &str) -> bool {
    let extension = VaultResource::BackgroundArchiveExtension.as_str();
    let Some(without_extension) = file_name.strip_suffix(extension) else {
        return false;
    };
    let prefixes = [
        VaultResource::BackgroundWindowsPrefix.as_str(),
        VaultResource::BackgroundMacosPrefix.as_str(),
        VaultResource::BackgroundLinuxPrefix.as_str(),
        VaultResource::BackgroundIosPrefix.as_str(),
        VaultResource::BackgroundAndroidPrefix.as_str(),
    ];
    prefixes.iter().any(|prefix| {
        without_extension
            .strip_prefix(prefix)
            .is_some_and(|digest| {
                digest.len() == 64 && digest.bytes().all(|byte| byte.is_ascii_hexdigit())
            })
    })
}

async fn restore_cloud_background_asset(
    adapter: &mut dyn FileTransport,
    settings: &mut AppSettings,
    asset: &CloudBackgroundAsset,
    platform: Platform,
) -> Result<(), AppError> {
    if asset.remote_file != background_asset_file_name(platform, &asset.sha256)
        || asset.uncompressed_size > u64::from(VaultPolicy::MaximumBackgroundBytes.value())
    {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "云端背景资源索引无效",
        ));
    }
    let temp = background_temp_path()?;
    let _cleanup = EncryptedTempFile(temp.clone());
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);
    let drain = tokio::spawn(async move { while rx.recv().await.is_some() {} });
    let result = adapter
        .download_file(
            &cloud_resource_path(&asset.remote_file),
            &temp.to_string_lossy(),
            tx,
        )
        .await;
    let _ = drain.await;
    result?;

    let file = std::fs::File::open(&temp)
        .map_err(|error| AppError::new(ErrorCode::StorageReadFailed, error.to_string()))?;
    let limit = u64::from(VaultPolicy::MaximumBackgroundBytes.value()) + 1;
    let mut decoder = GzDecoder::new(file).take(limit);
    let mut bytes = Vec::new();
    decoder
        .read_to_end(&mut bytes)
        .map_err(|error| AppError::new(ErrorCode::InvalidBackup, error.to_string()))?;
    if bytes.len() > VaultPolicy::MaximumBackgroundBytes.value() as usize
        || bytes.len() as u64 != asset.uncompressed_size
    {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "云端背景资源解压后大小不一致",
        ));
    }
    let digest = Sha256::digest(&bytes);
    let sha256: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    if sha256 != asset.sha256 {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "云端背景资源摘要校验失败",
        ));
    }

    let safe_name = Path::new(&asset.file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::new(ErrorCode::InvalidBackup, "云端背景图片名称无效"))?;
    let directory =
        SettingsService::default_data_dir()?.join(AppDirectory::VaultBackgroundRoot.as_str());
    std::fs::create_dir_all(&directory)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    let path = directory.join(safe_name);
    crate::local_fs::atomic_write(&path, &bytes)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    settings.background_image_path = Some(path.to_string_lossy().into_owned());
    Ok(())
}

async fn download_remote_document(
    adapter: &mut dyn FileTransport,
) -> Result<Option<PortableVaultDocument>, AppError> {
    if !remote_vault_exists(adapter).await? {
        return Ok(None);
    }
    let temp = encrypted_temp_path()?;
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);
    let drain = tokio::spawn(async move { while rx.recv().await.is_some() {} });
    let result = adapter
        .download_file(&cloud_file_path(), &temp.to_string_lossy(), tx)
        .await;
    let _ = drain.await;
    result?;
    let _cleanup = EncryptedTempFile(temp.clone());
    let serialized = std::fs::read(&temp)
        .map_err(|error| AppError::new(ErrorCode::StorageReadFailed, error.to_string()))?;
    if serialized.len() > VaultPolicy::MaximumFileBytes.value() as usize {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "云端保险库超过 32 MiB 安全限制",
        ));
    }
    serde_json::from_slice(&serialized)
        .map(Some)
        .map_err(invalid_backup_error)
}

async fn upload_document(
    adapter: &mut dyn FileTransport,
    document: &PortableVaultDocument,
) -> Result<(), AppError> {
    let temp = encrypted_temp_path()?;
    let _cleanup = EncryptedTempFile(temp.clone());
    let serialized = serde_json::to_vec(document).map_err(invalid_backup_error)?;
    std::fs::write(&temp, serialized)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);
    let drain = tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            if matches!(event, ProgressEvent::Done | ProgressEvent::Error(_)) {
                break;
            }
        }
    });
    let result = adapter
        .upload_file(&temp.to_string_lossy(), &cloud_file_path(), tx)
        .await;
    let _ = drain.await;
    result
}

fn encrypted_temp_path() -> Result<PathBuf, AppError> {
    let directory = std::env::temp_dir()
        .join(VaultResource::CloudDirectory.as_str())
        .join(VaultResource::TemporaryDirectory.as_str());
    std::fs::create_dir_all(&directory)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    Ok(directory.join(format!("{}.sytfm", Uuid::new_v4())))
}

fn background_temp_path() -> Result<PathBuf, AppError> {
    let directory = std::env::temp_dir()
        .join(VaultResource::CloudDirectory.as_str())
        .join(VaultResource::TemporaryDirectory.as_str());
    std::fs::create_dir_all(&directory)
        .map_err(|error| AppError::new(ErrorCode::StorageWriteFailed, error.to_string()))?;
    Ok(directory.join(Uuid::new_v4().to_string()))
}

fn cloud_resource_path(file_name: &str) -> String {
    format!("/{}/{}", VaultResource::CloudDirectory.as_str(), file_name)
}

fn cloud_file_path() -> String {
    cloud_resource_path(VaultResource::CloudFile.as_str())
}

fn invalid_backup_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::InvalidBackup, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_mutation_marks_enabled_vault_pending_and_advances_generation() {
        let mut settings = AppSettings::default();
        settings.vault_sync.enabled = true;

        mark_host_sync_pending(&mut settings);

        assert!(settings.vault_sync.sync_pending);
        assert_eq!(settings.vault_sync.sync_change_generation, 1);
    }

    #[test]
    fn idle_runtime_phase_exposes_durable_pending_after_restart() {
        assert_eq!(
            resolved_sync_phase(VaultSyncPhase::Idle, true),
            VaultSyncPhase::Pending
        );
        assert_eq!(
            resolved_sync_phase(VaultSyncPhase::Idle, false),
            VaultSyncPhase::Idle
        );
    }

    #[test]
    fn portable_payload_keeps_complete_settings_and_plaintext_password() {
        let mut settings = AppSettings {
            default_download_path: Some("C:/Downloads".to_string()),
            default_data_path: Some("D:/Data".to_string()),
            background_image_path: None,
            ..AppSettings::default()
        };
        settings.hosts.push(RemoteHost {
            id: Uuid::new_v4(),
            name: "host".to_string(),
            protocol: Protocol::Sftp,
            host: "example.com".to_string(),
            port: 22,
            username: "alice".to_string(),
            password: "plain-secret".to_string(),
            tags: String::new(),
            download_path: Some("C:/Host".to_string()),
            https: true,
            base_path: None,
            sftp_host_key_fingerprint: Some("SHA256:device-trust".to_string()),
            is_connected: false,
        });

        let payload = build_portable_payload(settings).expect("build payload");
        assert_eq!(payload.settings.hosts[0].password, "plain-secret");
        assert_eq!(
            payload.settings.default_download_path.as_deref(),
            Some("C:/Downloads")
        );
        assert_eq!(
            payload.settings.default_data_path.as_deref(),
            Some("D:/Data")
        );
        assert_eq!(
            payload.settings.hosts[0].download_path.as_deref(),
            Some("C:/Host")
        );
        assert_eq!(
            payload.settings.hosts[0]
                .sftp_host_key_fingerprint
                .as_deref(),
            Some("SHA256:device-trust")
        );
        assert!(payload.background_image.is_none());
        assert!(!payload.settings.vault_sync.enabled);
    }

    #[test]
    fn cloud_backup_path_is_stable() {
        assert_eq!(cloud_file_path(), "/SY-TFM/sy-tfm-vault.sytfm");
    }

    #[tokio::test]
    async fn mismatched_backup_password_confirmation_is_rejected_before_storage() {
        let error = save_backup_password(
            "correct-password".to_string(),
            "different-password".to_string(),
        )
        .await
        .expect_err("mismatched confirmation must fail");

        assert_eq!(error.code, ErrorCode::InvalidBackup);
    }

    #[test]
    fn local_background_bytes_are_embedded_in_the_encrypted_payload() {
        let path = std::env::temp_dir().join(format!("sy-tfm-background-{}.png", Uuid::new_v4()));
        let expected = vec![0x89, b'P', b'N', b'G', 1, 2, 3, 4];
        std::fs::write(&path, &expected).expect("write background fixture");
        let settings = AppSettings {
            background_image_path: Some(path.to_string_lossy().into_owned()),
            ..AppSettings::default()
        };

        let image = capture_background_image(&settings)
            .expect("capture background")
            .expect("embedded background");
        let actual = base64::engine::general_purpose::STANDARD
            .decode(image.data_base64)
            .expect("decode embedded background");
        let _ = std::fs::remove_file(path);

        assert_eq!(actual, expected);
        assert!(image.file_name.ends_with(".png"));
    }

    #[test]
    fn cloud_background_is_referenced_by_digest_instead_of_base64() {
        let path =
            std::env::temp_dir().join(format!("sy-tfm-cloud-background-{}.jpg", Uuid::new_v4()));
        let expected = b"background-bytes-that-must-not-enter-cloud-json".to_vec();
        std::fs::write(&path, &expected).expect("write background fixture");
        let settings = AppSettings {
            background_image_path: Some(path.to_string_lossy().into_owned()),
            ..AppSettings::default()
        };

        let prepared = build_cloud_payload_for_platform(settings, None, Platform::Android)
            .expect("build cloud payload");
        let platform = prepared
            .payload
            .platforms
            .iter()
            .find(|entry| entry.platform == Platform::Android)
            .expect("Android platform payload");
        let asset = platform
            .background_asset
            .as_ref()
            .expect("background asset");
        let serialized = serde_json::to_vec(&prepared.payload).expect("serialize cloud payload");
        let _ = std::fs::remove_file(path);

        assert!(platform.settings.background_image_path.is_none());
        assert!(platform.background_image.is_none());
        assert!(asset
            .remote_file
            .starts_with(VaultResource::BackgroundAndroidPrefix.as_str()));
        assert!(asset
            .remote_file
            .ends_with(VaultResource::BackgroundArchiveExtension.as_str()));
        assert_eq!(asset.uncompressed_size, expected.len() as u64);
        assert_eq!(prepared.background_assets.len(), 1);
        assert_eq!(prepared.background_assets[0].bytes, expected);
        assert!(!serialized
            .windows(expected.len())
            .any(|window| window == expected.as_slice()));
    }

    #[test]
    fn unchanged_existing_background_asset_is_not_uploaded_again() {
        let local = CloudBackgroundAsset {
            file_name: "wallpaper.jpg".to_string(),
            remote_file: background_asset_file_name(Platform::Android, "same-digest"),
            sha256: "same-digest".to_string(),
            uncompressed_size: 4096,
        };

        assert!(!background_asset_needs_upload(
            &local,
            std::slice::from_ref(&local),
            true,
        ));
        assert!(background_asset_needs_upload(
            &local,
            std::slice::from_ref(&local),
            false,
        ));
    }

    #[test]
    fn managed_background_names_are_content_addressed_and_path_safe() {
        let digest = "a".repeat(64);
        let valid = background_asset_file_name(Platform::Android, &digest);

        assert!(is_managed_background_asset_name(&valid));
        assert!(!is_managed_background_asset_name(
            "../background-android-unsafe.gz"
        ));
        assert!(!is_managed_background_asset_name(
            "background-android-short.gz"
        ));
    }

    #[test]
    fn pausing_preserves_saved_credentials_passwords_and_vault_metadata() {
        let mut settings = AppSettings {
            vault_sync: VaultSyncSettings {
                enabled: true,
                webdav_url: "https://cloud.example.com/dav".to_string(),
                username: "alice".to_string(),
                password: "encrypted-webdav".to_string(),
                backup_password: "encrypted-backup".to_string(),
                vault_id: "vault-id".to_string(),
                key_envelope: None,
                last_synced_revision: 7,
                last_synced_at: Some("2026-07-19T00:00:00Z".to_string()),
                last_synced_scope_hash: "scope-hash".to_string(),
                last_synced_hosts_hash: "hosts-hash".to_string(),
                last_synced_hosts_snapshot: "encrypted-snapshot".to_string(),
                last_synced_platform_hash: "platform-hash".to_string(),
                sync_pending: false,
                sync_change_generation: 0,
            },
            ..AppSettings::default()
        };

        pause_settings(&mut settings);

        assert!(!settings.vault_sync.enabled);
        assert_eq!(
            settings.vault_sync.webdav_url,
            "https://cloud.example.com/dav"
        );
        assert_eq!(settings.vault_sync.password, "encrypted-webdav");
        assert_eq!(settings.vault_sync.backup_password, "encrypted-backup");
        assert_eq!(settings.vault_sync.vault_id, "vault-id");
        assert_eq!(settings.vault_sync.last_synced_revision, 7);
        assert_eq!(settings.vault_sync.last_synced_scope_hash, "scope-hash");
        assert_eq!(settings.vault_sync.last_synced_hosts_hash, "hosts-hash");
        assert_eq!(
            settings.vault_sync.last_synced_hosts_snapshot,
            "encrypted-snapshot"
        );
        assert_eq!(
            settings.vault_sync.last_synced_platform_hash,
            "platform-hash"
        );
    }

    #[test]
    fn cloud_payload_keeps_shared_hosts_and_separate_platform_settings() {
        let mut windows_host = sample_host("windows-host");
        windows_host.download_path = Some("C:/Windows/Downloads".to_string());
        let windows_settings = AppSettings {
            accent_color: "windows-accent".to_string(),
            hosts: vec![windows_host],
            ..AppSettings::default()
        };
        let windows_prepared =
            build_cloud_payload_for_platform(windows_settings, None, Platform::Windows)
                .expect("build Windows payload");

        let mut android_host = sample_host("shared-host");
        android_host.download_path = Some("/storage/emulated/0/Download/SY-TFM".to_string());
        let android_settings = AppSettings {
            accent_color: "android-accent".to_string(),
            hosts: vec![android_host],
            ..AppSettings::default()
        };
        let merged_prepared = build_cloud_payload_for_platform(
            android_settings,
            Some(windows_prepared.payload),
            Platform::Android,
        )
        .expect("merge Android payload");
        let merged = merged_prepared.payload;

        assert_eq!(merged.hosts.len(), 1);
        assert_eq!(merged.hosts[0].name, "shared-host");
        assert!(merged.hosts[0].download_path.is_none());
        assert_eq!(merged.platforms.len(), 2);
        assert_eq!(
            merged
                .platforms
                .iter()
                .find(|entry| entry.platform == Platform::Windows)
                .expect("Windows settings")
                .settings
                .accent_color,
            "windows-accent"
        );
        assert_eq!(
            merged
                .platforms
                .iter()
                .find(|entry| entry.platform == Platform::Android)
                .expect("Android settings")
                .settings
                .accent_color,
            "android-accent"
        );
        assert!(merged
            .platforms
            .iter()
            .all(|entry| entry.settings.hosts.is_empty()));
        assert_eq!(
            merged
                .platforms
                .iter()
                .find(|entry| entry.platform == Platform::Windows)
                .expect("Windows settings")
                .host_settings[0]
                .download_path
                .as_deref(),
            Some("C:/Windows/Downloads")
        );
        assert_eq!(
            merged
                .platforms
                .iter()
                .find(|entry| entry.platform == Platform::Android)
                .expect("Android settings")
                .host_settings[0]
                .download_path
                .as_deref(),
            Some("/storage/emulated/0/Download/SY-TFM")
        );

        let (android_restored, _, _) =
            restore_cloud_settings_for_platform(merged, Platform::Android);
        assert_eq!(android_restored.accent_color, "android-accent");
        assert_eq!(
            android_restored.hosts[0].download_path.as_deref(),
            Some("/storage/emulated/0/Download/SY-TFM")
        );
    }

    #[test]
    fn restore_without_current_platform_settings_uses_defaults_and_shared_hosts() {
        let payload = CloudVaultPayload {
            schema_version: VaultPolicy::CloudPayloadSchemaVersion.value(),
            hosts: vec![sample_host("shared-host")],
            platforms: Vec::new(),
        };

        let (restored, background, asset) =
            restore_cloud_settings_for_platform(payload, Platform::Android);

        assert_eq!(restored.hosts.len(), 1);
        assert_eq!(restored.hosts[0].name, "shared-host");
        assert_eq!(restored.theme, AppSettings::default().theme);
        assert!(background.is_none());
        assert!(asset.is_none());
    }

    #[test]
    fn legacy_cloud_payload_migrates_only_provably_shared_hosts() {
        let legacy = PortableVaultPayload {
            schema_version: VaultPolicy::PortablePayloadSchemaVersion.value(),
            settings: AppSettings {
                accent_color: "unidentified-platform-accent".to_string(),
                hosts: vec![sample_host("legacy-host")],
                ..AppSettings::default()
            },
            background_image: None,
        };
        let serialized = serde_json::to_vec(&legacy).expect("serialize legacy payload");

        let migrated = parse_cloud_payload(&serialized).expect("migrate legacy payload");

        assert_eq!(migrated.hosts.len(), 1);
        assert_eq!(migrated.hosts[0].name, "legacy-host");
        assert!(migrated.platforms.is_empty());
        assert_eq!(
            migrated.schema_version,
            VaultPolicy::CloudPayloadSchemaVersion.value()
        );
    }

    #[test]
    fn cloud_scope_hash_ignores_other_platform_settings() {
        let windows_settings = AppSettings {
            accent_color: "windows-accent".to_string(),
            hosts: vec![sample_host("shared-host")],
            ..AppSettings::default()
        };
        let mut payload =
            build_cloud_payload_for_platform(windows_settings, None, Platform::Windows)
                .expect("build Windows payload")
                .payload;
        let before = cloud_scope_hash(&payload, Platform::Windows).expect("hash Windows scope");

        payload.platforms.push(CloudPlatformPayload {
            platform: Platform::Android,
            settings: AppSettings {
                accent_color: "android-changed".to_string(),
                ..AppSettings::default()
            },
            host_settings: Vec::new(),
            background_asset: None,
            background_image: None,
        });
        let after = cloud_scope_hash(&payload, Platform::Windows).expect("hash Windows scope");

        assert_eq!(before, after);
    }

    #[test]
    fn cloud_scope_hash_tracks_shared_hosts_and_current_platform() {
        let windows_settings = AppSettings {
            accent_color: "windows-accent".to_string(),
            hosts: vec![sample_host("shared-host")],
            ..AppSettings::default()
        };
        let mut payload =
            build_cloud_payload_for_platform(windows_settings, None, Platform::Windows)
                .expect("build Windows payload")
                .payload;
        let baseline = cloud_scope_hash(&payload, Platform::Windows).expect("hash baseline");

        payload.hosts[0].name = "renamed-host".to_string();
        let host_changed = cloud_scope_hash(&payload, Platform::Windows).expect("hash host change");
        assert_ne!(baseline, host_changed);

        payload.hosts[0].name = "shared-host".to_string();
        payload.platforms[0].settings.accent_color = "windows-changed".to_string();
        let platform_changed =
            cloud_scope_hash(&payload, Platform::Windows).expect("hash platform change");
        assert_ne!(baseline, platform_changed);
    }

    #[test]
    fn scope_change_direction_pulls_remote_pushes_local_and_rejects_concurrent_edits() {
        assert_eq!(
            classify_scope_change("same", "same", "base"),
            Some((false, false))
        );
        assert_eq!(
            classify_scope_change("base", "remote", "base"),
            Some((true, false))
        );
        assert_eq!(
            classify_scope_change("local", "base", "base"),
            Some((false, true))
        );
        assert_eq!(classify_scope_change("local", "remote", "base"), None);
    }

    #[test]
    fn remote_host_changes_merge_with_local_platform_setting_changes() {
        let base = build_cloud_payload_for_platform(
            AppSettings {
                accent_color: "base-accent".to_string(),
                hosts: vec![sample_host("base-host")],
                ..AppSettings::default()
            },
            None,
            Platform::Android,
        )
        .expect("build base")
        .payload;
        let base_hosts_hash = cloud_hosts_hash(&base).expect("hash base hosts");
        let base_platform_hash =
            cloud_platform_hash(&base, Platform::Android).expect("hash base platform");

        let mut remote = base.clone();
        remote.hosts = vec![sample_host("remote-host")];
        let local = build_cloud_payload_for_platform(
            AppSettings {
                accent_color: "local-accent".to_string(),
                hosts: base.hosts.clone(),
                ..AppSettings::default()
            },
            Some(base.clone()),
            Platform::Android,
        )
        .expect("build local")
        .payload;

        assert_eq!(
            classify_scope_change(
                &cloud_hosts_hash(&local).expect("hash local hosts"),
                &cloud_hosts_hash(&remote).expect("hash remote hosts"),
                &base_hosts_hash,
            ),
            Some((true, false))
        );
        assert_eq!(
            classify_scope_change(
                &cloud_platform_hash(&local, Platform::Android).expect("hash local platform"),
                &cloud_platform_hash(&remote, Platform::Android).expect("hash remote platform"),
                &base_platform_hash,
            ),
            Some((false, true))
        );

        replace_platform_payload(&mut remote, &local, Platform::Android);
        let (merged, _, _) = restore_cloud_settings_for_platform(remote, Platform::Android);
        assert_eq!(merged.hosts[0].name, "remote-host");
        assert_eq!(merged.accent_color, "local-accent");
    }

    #[test]
    fn platform_host_settings_ignore_missing_null_override_after_remote_addition() {
        let mut existing = sample_host("existing-host");
        existing.download_path = Some("/storage/emulated/0/Download/existing".to_string());
        let mut remote = build_cloud_payload_for_platform(
            AppSettings {
                hosts: vec![existing],
                ..AppSettings::default()
            },
            None,
            Platform::Android,
        )
        .expect("build Android baseline")
        .payload;
        remote.hosts.push(sample_host("remote-added-host"));

        let (restored, _, _) =
            restore_cloud_settings_for_platform(remote.clone(), Platform::Android);
        let rebuilt =
            build_cloud_payload_for_platform(restored, Some(remote.clone()), Platform::Android)
                .expect("rebuild Android payload after pull")
                .payload;

        assert_eq!(
            cloud_platform_hash(&rebuilt, Platform::Android).expect("hash rebuilt platform"),
            cloud_platform_hash(&remote, Platform::Android).expect("hash remote platform")
        );
    }

    #[test]
    fn platform_host_settings_ignore_stale_override_after_remote_deletion() {
        let mut kept = sample_host("kept-host");
        kept.download_path = Some("/storage/emulated/0/Download/kept".to_string());
        let mut deleted = sample_host("deleted-host");
        deleted.download_path = Some("/storage/emulated/0/Download/deleted".to_string());
        let mut remote = build_cloud_payload_for_platform(
            AppSettings {
                hosts: vec![kept, deleted],
                ..AppSettings::default()
            },
            None,
            Platform::Android,
        )
        .expect("build Android baseline")
        .payload;
        remote.hosts.remove(1);

        let (restored, _, _) =
            restore_cloud_settings_for_platform(remote.clone(), Platform::Android);
        let rebuilt =
            build_cloud_payload_for_platform(restored, Some(remote.clone()), Platform::Android)
                .expect("rebuild Android payload after deletion")
                .payload;

        assert_eq!(
            cloud_platform_hash(&rebuilt, Platform::Android).expect("hash rebuilt platform"),
            cloud_platform_hash(&remote, Platform::Android).expect("hash remote platform")
        );
    }

    #[test]
    fn platform_host_settings_ignore_override_order_after_remote_reorder() {
        let mut first = sample_host("first-host");
        first.download_path = Some("/storage/emulated/0/Download/first".to_string());
        let mut second = sample_host("second-host");
        second.download_path = Some("/storage/emulated/0/Download/second".to_string());
        let mut remote = build_cloud_payload_for_platform(
            AppSettings {
                hosts: vec![first, second],
                ..AppSettings::default()
            },
            None,
            Platform::Android,
        )
        .expect("build Android baseline")
        .payload;
        remote.hosts.reverse();

        let (restored, _, _) =
            restore_cloud_settings_for_platform(remote.clone(), Platform::Android);
        let rebuilt =
            build_cloud_payload_for_platform(restored, Some(remote.clone()), Platform::Android)
                .expect("rebuild Android payload after reorder")
                .payload;

        assert_eq!(
            cloud_platform_hash(&rebuilt, Platform::Android).expect("hash rebuilt platform"),
            cloud_platform_hash(&remote, Platform::Android).expect("hash remote platform")
        );
    }

    fn sample_host(name: &str) -> RemoteHost {
        RemoteHost {
            id: Uuid::new_v4(),
            name: name.to_string(),
            protocol: Protocol::Sftp,
            host: "example.com".to_string(),
            port: 22,
            username: "alice".to_string(),
            password: "plain-secret".to_string(),
            tags: String::new(),
            download_path: None,
            https: true,
            base_path: None,
            sftp_host_key_fingerprint: None,
            is_connected: false,
        }
    }

    #[test]
    fn host_merge_applies_remote_delete_without_dropping_new_local_host() {
        let synced = sample_host("synced-a");
        let local_only = sample_host("local-b");
        let merged = merge_hosts_three_way(
            std::slice::from_ref(&synced),
            &[synced.clone(), local_only.clone()],
            &[],
        )
        .expect("independent delete and add should merge");

        assert_eq!(merged, vec![local_only]);
    }

    #[test]
    fn host_merge_unions_independent_additions_from_both_devices() {
        let local = sample_host("android-host");
        let remote = sample_host("windows-host");
        let merged = merge_hosts_three_way(
            &[],
            std::slice::from_ref(&local),
            std::slice::from_ref(&remote),
        )
        .expect("different host ids should merge");

        assert_eq!(merged, vec![remote, local]);
    }

    #[test]
    fn host_merge_does_not_resurrect_a_deleted_concurrently_edited_host() {
        let base = sample_host("old-name");
        let mut remote_edit = base.clone();
        remote_edit.name = "new-name".to_string();

        let merged = merge_hosts_three_way(std::slice::from_ref(&base), &[], &[remote_edit])
            .expect("deletion should win over a stale concurrent edit");
        assert!(merged.is_empty());
    }

    #[test]
    fn host_merge_reports_same_host_concurrent_edits() {
        let base = sample_host("base");
        let base_id = base.id;
        let mut local = base.clone();
        local.host = "local.example.com".to_string();
        let mut remote = base.clone();
        remote.host = "remote.example.com".to_string();

        assert_eq!(
            merge_hosts_three_way(&[base], &[local], &[remote]),
            Err(HostMergeError::ConcurrentEdit(base_id))
        );
    }
}
