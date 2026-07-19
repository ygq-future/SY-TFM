//! 跨设备保险库编排：本机设备加密、便携 Vault 与 WebDAV Adapter 之间的边界。

use std::path::{Path, PathBuf};
use std::sync::{Mutex as StdMutex, OnceLock};

use base64::Engine;
use serde::{Deserialize, Serialize};
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
use crate::enums::{ErrorCode, Protocol};
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
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableVaultPayload {
    schema_version: u32,
    settings: AppSettings,
    #[serde(default)]
    background_image: Option<PortableBackgroundImage>,
}

/// 随保险库加密保存的本地背景图片。
#[derive(Debug, Serialize, Deserialize)]
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
    Ok(VaultSyncStatus {
        configured: !sync.webdav_url.is_empty()
            && !sync.username.is_empty()
            && !sync.password.is_empty(),
        enabled: sync.enabled,
        vault_initialized: !sync.vault_id.is_empty() && sync.key_envelope.is_some(),
        password_saved: !sync.password.is_empty(),
        backup_password_saved: !sync.backup_password.is_empty(),
        webdav_url: sync.webdav_url,
        username: sync.username,
        remote_path: cloud_file_path(),
        revision: sync.last_synced_revision,
        last_synced_at: sync.last_synced_at,
        unlocked_on_device: key_storage::get_vault_key()?.is_some(),
        refresh_interval_ms: VaultPolicy::StatusRefreshMilliseconds.value(),
    })
}

/// 在配置连续变化停止后自动上传一次；后来的调用会替换尚未执行的任务。
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
    let payload = build_payload(settings)?;
    let plaintext = serde_json::to_vec(&payload).map_err(invalid_backup_error)?;
    let vault_id = Uuid::new_v4().to_string();
    let (document, key) =
        PortableVaultDocument::create(&plaintext, &backup_password, vault_id.clone(), 1)?;
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

/// 将当前设置上传为下一个保险库 revision。
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
    let mut adapter = connect_webdav(&credentials).await?;
    ensure_cloud_directory(adapter.as_mut()).await?;

    if let Some(remote) = download_remote_document(adapter.as_mut()).await? {
        if remote.vault_id != sync.vault_id || remote.revision > sync.last_synced_revision {
            let _ = adapter.disconnect().await;
            return Err(AppError::new(
                ErrorCode::SyncConflict,
                "云端保险库包含更新版本，请先从云端恢复后再同步",
            ));
        }
    }

    let key = resolve_vault_key(backup_password.as_deref(), &sync)?;
    let payload = build_payload(settings.clone())?;
    let plaintext = serde_json::to_vec(&payload).map_err(invalid_backup_error)?;
    let revision = sync.last_synced_revision.saturating_add(1);
    let document =
        PortableVaultDocument::encrypt(&plaintext, key, sync.vault_id.clone(), revision, envelope)?;
    upload_document(adapter.as_mut(), &document).await?;
    let _ = adapter.disconnect().await;

    let mut latest = SettingsService::load()?;
    if latest.vault_sync.vault_id != sync.vault_id {
        return Err(AppError::new(
            ErrorCode::SyncConflict,
            "同步期间本机保险库配置已变化",
        ));
    }
    latest.vault_sync.last_synced_revision = revision;
    latest.vault_sync.last_synced_at = Some(document.updated_at);
    SettingsService::save(&latest)?;
    status()
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
    let _ = adapter.disconnect().await;

    let (plaintext, key) = document.decrypt_with_password(&backup_password)?;
    let payload: PortableVaultPayload =
        serde_json::from_slice(&plaintext).map_err(invalid_backup_error)?;
    if payload.schema_version != 1 {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            format!("不支持的保险库载荷版本: {}", payload.schema_version),
        ));
    }

    let mut restored = payload.settings;
    restore_background_image(&mut restored, payload.background_image)?;
    restored.vault_sync = VaultSyncSettings {
        enabled: true,
        webdav_url: credentials.webdav_url,
        username: credentials.username,
        password: credentials.password,
        backup_password: backup_password.clone(),
        vault_id: document.vault_id,
        key_envelope: Some(document.key_envelope),
        last_synced_revision: document.revision,
        last_synced_at: Some(document.updated_at),
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

/// 恢复已初始化保险库的自动同步，并立即上传当前配置。
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
    let payload = build_payload(settings.clone())?;
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

fn build_payload(mut settings: AppSettings) -> Result<PortableVaultPayload, AppError> {
    let key = key_storage::get_or_create_master_key()?;
    let protector = SecretProtector::new(key);
    for host in &mut settings.hosts {
        if host.password.starts_with(ENCRYPTED_PREFIX) {
            host.password = protector.decrypt(&host.password)?;
        }
    }
    let background_image = capture_background_image(&settings)?;
    settings.vault_sync = VaultSyncSettings::default();
    Ok(PortableVaultPayload {
        schema_version: 1,
        settings,
        background_image,
    })
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

fn cloud_file_path() -> String {
    format!(
        "/{}/{}",
        VaultResource::CloudDirectory.as_str(),
        VaultResource::CloudFile.as_str()
    )
}

fn invalid_backup_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::InvalidBackup, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

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

        let payload = build_payload(settings).expect("build payload");
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
    }
}
