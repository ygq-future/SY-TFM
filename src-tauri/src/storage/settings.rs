//! 配置服务：读写 `settings.json`。

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use directories::ProjectDirs;

use crate::enums::ErrorCode;
use crate::error::AppError;
use crate::models::AppSettings;
use crate::{crypto::key_storage, crypto::secret_protector::SecretProtector};

/// 应用配置服务。
pub struct SettingsService;

static PLATFORM_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

impl SettingsService {
    /// 注入由 Tauri 平台路径解析器提供的应用数据目录。
    pub fn set_platform_data_dir(path: PathBuf) {
        let _ = PLATFORM_DATA_DIR.set(path);
    }

    /// 加载配置。
    ///
    /// 文件不存在则返回默认值；损坏则回退默认值（最佳努力，不丢失主机列表由后续迁移保障）。
    pub fn load() -> Result<AppSettings, AppError> {
        let path = Self::settings_file_path()?;
        let Some(loaded) = load_settings_from_path(&path)? else {
            return Ok(AppSettings::default());
        };
        let mut settings = loaded.into_settings();

        let mut changed = false;
        if settings.config_version < 3 {
            settings.config_version = 3;
            changed = true;
        }
        changed |= encrypt_plaintext_passwords(&mut settings)?;
        if changed {
            Self::write(&settings)?;
        }
        Ok(settings)
    }

    /// 保存配置。
    pub fn save(settings: &AppSettings) -> Result<(), AppError> {
        let mut protected = settings.clone();
        encrypt_plaintext_passwords(&mut protected)?;
        Self::write(&protected)
    }

    /// 将已完成加密升级的配置写入磁盘。
    fn write(settings: &AppSettings) -> Result<(), AppError> {
        let base_path = Self::default_settings_file_path()?;
        let portable_mode = crate::storage::portable_mode::portable_data_dir()?.is_some();
        let path = if portable_mode {
            base_path.clone()
        } else {
            settings
                .default_data_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .map(PathBuf::from)
                .map(|path| path.join("settings.json"))
                .unwrap_or_else(|| base_path.clone())
        };
        Self::write_json(&path, settings)?;

        if !portable_mode && path != base_path {
            let locator = AppSettings {
                default_data_path: settings.default_data_path.clone(),
                ..AppSettings::default()
            };
            Self::write_json(&base_path, &locator)?;
        }
        Ok(())
    }

    fn write_json(path: &Path, settings: &AppSettings) -> Result<(), AppError> {
        let json = serde_json::to_vec_pretty(settings).map_err(storage_write_error)?;
        crate::local_fs::atomic_write(&backup_path(path), &json).map_err(storage_write_error)?;
        crate::local_fs::atomic_write(path, &json).map_err(storage_write_error)?;
        Ok(())
    }

    /// 配置文件路径。
    pub fn settings_file_path() -> Result<PathBuf, AppError> {
        resolve_settings_file_path(&Self::default_settings_file_path()?)
    }

    /// 平台默认应用数据目录。
    pub fn default_data_dir() -> Result<PathBuf, AppError> {
        if let Some(portable_data_dir) = crate::storage::portable_mode::portable_data_dir()? {
            return Ok(portable_data_dir);
        }
        if let Some(path) = PLATFORM_DATA_DIR.get() {
            return Ok(path.clone());
        }
        let proj = ProjectDirs::from("com", "sy", "SY-TFM")
            .ok_or_else(|| AppError::new(ErrorCode::PlatformUnsupported, "无法确定平台配置目录"))?;
        Ok(proj.data_local_dir().to_path_buf())
    }

    fn default_settings_file_path() -> Result<PathBuf, AppError> {
        Ok(Self::default_data_dir()?.join("settings.json"))
    }
}

fn backup_path(path: &Path) -> PathBuf {
    let mut file_name = path
        .file_name()
        .map(OsString::from)
        .unwrap_or_else(|| OsString::from("settings.json"));
    file_name.push(".bak");
    path.with_file_name(file_name)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SettingsSource {
    Primary,
    Backup,
}

#[derive(Debug)]
struct LoadedSettings {
    settings: AppSettings,
    source: SettingsSource,
}

impl LoadedSettings {
    fn into_settings(self) -> AppSettings {
        let _source = self.source;
        self.settings
    }
}

#[derive(Debug)]
enum SettingsFileError {
    Io(std::io::Error),
    Format,
}

fn load_settings_from_path(path: &Path) -> Result<Option<LoadedSettings>, AppError> {
    match parse_or_migrate_settings(path) {
        Ok(settings) => Ok(Some(LoadedSettings {
            settings,
            source: SettingsSource::Primary,
        })),
        Err(SettingsFileError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(None)
        }
        Err(SettingsFileError::Io(error)) => Err(storage_read_error(error)),
        Err(SettingsFileError::Format) => {
            let backup = backup_path(path);
            match parse_or_migrate_settings(&backup) {
                Ok(settings) => {
                    repair_primary_from_backup(path, &settings)?;
                    Ok(Some(LoadedSettings {
                        settings,
                        source: SettingsSource::Backup,
                    }))
                }
                Err(SettingsFileError::Io(error))
                    if error.kind() == std::io::ErrorKind::NotFound =>
                {
                    Ok(Some(LoadedSettings {
                        settings: AppSettings::default(),
                        source: SettingsSource::Primary,
                    }))
                }
                Err(SettingsFileError::Io(error)) => Err(storage_read_error(error)),
                Err(SettingsFileError::Format) => Ok(Some(LoadedSettings {
                    settings: AppSettings::default(),
                    source: SettingsSource::Primary,
                })),
            }
        }
    }
}

fn parse_or_migrate_settings(path: &Path) -> Result<AppSettings, SettingsFileError> {
    let content = std::fs::read_to_string(path).map_err(SettingsFileError::Io)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| SettingsFileError::Format)?;
    parse_settings_value(value)
}

fn parse_settings_value(value: serde_json::Value) -> Result<AppSettings, SettingsFileError> {
    if needs_legacy_migration(&value) {
        return migrate_legacy_value(value);
    }
    serde_json::from_value::<AppSettings>(value).map_err(|_| SettingsFileError::Format)
}

fn needs_legacy_migration(value: &serde_json::Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    [
        "Hosts",
        "Theme",
        "AccentColor",
        "Language",
        "DefaultDownloadPath",
    ]
    .iter()
    .any(|key| object.contains_key(*key))
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "PascalCase")]
struct LegacySettingsValue {
    #[serde(default)]
    hosts: Vec<LegacyHostValue>,
    #[serde(default)]
    theme: Option<String>,
    #[serde(default)]
    accent_color: Option<String>,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    default_download_path: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "PascalCase")]
struct LegacyHostValue {
    name: String,
    host: String,
    port: u16,
    username: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    tags: Option<String>,
}

fn migrate_legacy_value(value: serde_json::Value) -> Result<AppSettings, SettingsFileError> {
    let legacy: LegacySettingsValue =
        serde_json::from_value(value).map_err(|_| SettingsFileError::Format)?;
    let hosts = legacy
        .hosts
        .into_iter()
        .map(|host| {
            let protocol = match host.port {
                22 => crate::enums::Protocol::Sftp,
                443 | 5005 | 5006 => crate::enums::Protocol::WebDav,
                _ => crate::enums::Protocol::Ftp,
            };
            crate::models::RemoteHost {
                id: uuid::Uuid::new_v4(),
                name: host.name,
                protocol,
                host: host.host,
                port: host.port,
                username: if host.username.is_empty() {
                    "anonymous".to_string()
                } else {
                    host.username
                },
                password: host.password,
                tags: host.tags.unwrap_or_default(),
                favorite_folders: Vec::new(),
                download_path: None,
                https: matches!(protocol, crate::enums::Protocol::WebDav),
                base_path: None,
                sftp_host_key_fingerprint: None,
                is_connected: false,
            }
        })
        .collect();

    Ok(AppSettings {
        theme: legacy
            .theme
            .as_deref()
            .map(|theme| match theme.to_ascii_lowercase().as_str() {
                "light" => crate::enums::Theme::Light,
                "dark" => crate::enums::Theme::Dark,
                _ => crate::enums::Theme::System,
            })
            .unwrap_or_default(),
        accent_color: legacy.accent_color.unwrap_or_else(|| "#2296F5".to_string()),
        language: legacy
            .language
            .as_deref()
            .map(|language| match language.to_ascii_lowercase().as_str() {
                "zh" | "chinese" => crate::enums::Language::Zh,
                _ => crate::enums::Language::En,
            })
            .unwrap_or_default(),
        default_download_path: legacy.default_download_path,
        hosts,
        config_version: 3,
        ..AppSettings::default()
    })
}

fn repair_primary_from_backup(path: &Path, settings: &AppSettings) -> Result<(), AppError> {
    let json = serde_json::to_vec_pretty(settings).map_err(storage_write_error)?;
    crate::local_fs::atomic_write(path, &json).map_err(storage_write_error)
}

fn resolve_settings_file_path(base_path: &Path) -> Result<PathBuf, AppError> {
    if crate::storage::portable_mode::portable_data_dir()?.is_some() {
        return Ok(base_path.to_path_buf());
    }
    let Some(loaded) = load_settings_from_path(base_path)? else {
        return Ok(base_path.to_path_buf());
    };
    let locator = loaded.settings;
    Ok(locator
        .default_data_path
        .as_deref()
        .filter(|path| !path.trim().is_empty())
        .map(PathBuf::from)
        .map(|path| path.join("settings.json"))
        .unwrap_or_else(|| base_path.to_path_buf()))
}

fn storage_read_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::StorageReadFailed, error.to_string())
}

fn storage_write_error(error: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::StorageWriteFailed, error.to_string())
}

/// 将旧配置中的明文密码升级为 `enc.v1:` 密文。
fn encrypt_plaintext_passwords(settings: &mut AppSettings) -> Result<bool, AppError> {
    let host_has_plaintext = settings.hosts.iter().any(|host| {
        !host.password.is_empty()
            && !host
                .password
                .starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX)
    });
    let sync_password_has_plaintext = !settings.vault_sync.password.is_empty()
        && !settings
            .vault_sync
            .password
            .starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX);
    let backup_password_has_plaintext = !settings.vault_sync.backup_password.is_empty()
        && !settings
            .vault_sync
            .backup_password
            .starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX);
    if !host_has_plaintext && !sync_password_has_plaintext && !backup_password_has_plaintext {
        return Ok(false);
    }

    let key = key_storage::get_or_create_master_key()?;
    let protector = SecretProtector::new(key);
    for host in &mut settings.hosts {
        if !host.password.is_empty()
            && !host
                .password
                .starts_with(crate::crypto::secret_protector::ENCRYPTED_PREFIX)
        {
            host.password = protector.encrypt(&host.password)?;
        }
    }
    if sync_password_has_plaintext {
        settings.vault_sync.password = protector.encrypt(&settings.vault_sync.password)?;
    }
    if backup_password_has_plaintext {
        settings.vault_sync.backup_password =
            protector.encrypt(&settings.vault_sync.backup_password)?;
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use uuid::Uuid;

    use super::{
        backup_path, load_settings_from_path, parse_settings_value, resolve_settings_file_path,
        SettingsService,
    };
    use crate::enums::{ErrorCode, Protocol};
    use crate::models::{AppSettings, RemoteHost};

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("sy-tfm-settings-{}", Uuid::new_v4()));
            std::fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn camel_case_settings_without_config_version_keep_hosts() {
        let dir = TestDir::new();
        let primary = dir.path().join("settings.json");
        let host = RemoteHost {
            id: Uuid::new_v4(),
            name: "current host".to_string(),
            protocol: Protocol::Sftp,
            host: "current.example.com".to_string(),
            port: 22,
            username: "alice".to_string(),
            password: "enc.v1:dGVzdA==".to_string(),
            tags: String::new(),
            favorite_folders: Vec::new(),
            download_path: None,
            https: true,
            base_path: None,
            sftp_host_key_fingerprint: None,
            is_connected: false,
        };
        let mut value = serde_json::to_value(AppSettings {
            hosts: vec![host],
            ..AppSettings::default()
        })
        .expect("serialize current settings");
        value
            .as_object_mut()
            .expect("settings object")
            .remove("configVersion");
        std::fs::write(
            &primary,
            serde_json::to_vec_pretty(&value).expect("serialize settings without version"),
        )
        .expect("write current settings");

        let loaded = load_settings_from_path(&primary)
            .expect("load current settings")
            .expect("current settings should exist")
            .settings;
        assert_eq!(loaded.hosts.len(), 1);
        assert_eq!(loaded.hosts[0].name, "current host");
    }

    #[test]
    fn legacy_value_migration_does_not_depend_on_source_file() {
        let dir = TestDir::new();
        let primary = dir.path().join("settings.json");
        let legacy = r#"{
            "Hosts": [{
                "Name": "legacy host",
                "Host": "example.com",
                "Port": 22,
                "Username": "alice",
                "Password": "enc.v1:dGVzdA=="
            }],
            "Theme": "dark"
        }"#;
        std::fs::write(&primary, legacy).expect("write legacy settings");
        let value: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&primary).expect("read legacy settings once"),
        )
        .expect("parse legacy JSON value");
        std::fs::remove_file(&primary).expect("remove source after read");

        let loaded = parse_settings_value(value).expect("migrate already-read legacy value");
        assert_eq!(loaded.hosts.len(), 1);
        assert_eq!(loaded.hosts[0].name, "legacy host");
    }

    #[test]
    fn v1_pascal_case_settings_are_migrated_without_losing_hosts() {
        let dir = TestDir::new();
        let primary = dir.path().join("settings.json");
        let legacy = r#"{
            "Hosts": [{
                "Name": "legacy host",
                "Host": "example.com",
                "Port": 22,
                "Username": "alice",
                "Password": "enc.v1:dGVzdA=="
            }],
            "Theme": "dark"
        }"#;
        std::fs::write(&primary, legacy).expect("write legacy settings");

        let loaded = load_settings_from_path(&primary)
            .expect("load legacy settings")
            .expect("legacy settings should exist")
            .settings;
        assert_eq!(loaded.hosts.len(), 1);
        assert_eq!(loaded.hosts[0].name, "legacy host");
        assert_eq!(loaded.hosts[0].host, "example.com");
    }

    #[test]
    fn backup_recovery_repairs_primary_without_overwriting_backup() {
        let dir = TestDir::new();
        let primary = dir.path().join("settings.json");
        let backup = backup_path(&primary);
        let expected = AppSettings {
            accent_color: "backup-accent".to_string(),
            ..AppSettings::default()
        };
        let expected_json = serde_json::to_vec_pretty(&expected).expect("serialize backup");

        std::fs::write(&primary, "{ broken").expect("write corrupt primary");
        std::fs::write(&backup, &expected_json).expect("write backup");

        let loaded = load_settings_from_path(&primary)
            .expect("load settings")
            .expect("backup should load");
        assert_eq!(loaded.source, super::SettingsSource::Backup);
        let loaded = loaded.settings;
        assert_eq!(loaded.accent_color, expected.accent_color);
        let repaired: AppSettings =
            serde_json::from_slice(&std::fs::read(&primary).expect("read repaired primary"))
                .expect("parse repaired primary");
        assert_eq!(repaired.accent_color, expected.accent_color);
        assert_eq!(
            std::fs::read(&backup).expect("read preserved backup"),
            expected_json
        );
    }

    #[test]
    fn read_io_errors_are_not_replaced_by_backup_or_defaults() {
        let dir = TestDir::new();
        let directory_path = dir.path().join("settings.json");
        std::fs::create_dir(&directory_path).expect("create directory at settings path");
        let backup = AppSettings {
            accent_color: "must-not-load".to_string(),
            ..AppSettings::default()
        };
        std::fs::write(
            backup_path(&directory_path),
            serde_json::to_vec_pretty(&backup).expect("serialize backup"),
        )
        .expect("write backup");

        let error = load_settings_from_path(&directory_path).expect_err("I/O error must propagate");
        assert_eq!(error.code, ErrorCode::StorageReadFailed);
    }

    #[test]
    fn first_write_creates_primary_and_backup() {
        let dir = TestDir::new();
        let primary = dir.path().join("nested").join("settings.json");
        let settings = AppSettings::default();

        SettingsService::write_json(&primary, &settings).expect("write settings");
        assert!(primary.is_file());
        assert!(backup_path(&primary).is_file());
        assert_eq!(
            std::fs::read(&primary).expect("read primary"),
            std::fs::read(backup_path(&primary)).expect("read backup")
        );
    }

    #[test]
    fn corrupt_primary_settings_falls_back_to_backup() {
        let dir = TestDir::new();
        let primary = dir.path().join("settings.json");
        let expected = AppSettings {
            accent_color: "backup-accent".to_string(),
            ..AppSettings::default()
        };

        std::fs::write(&primary, "{ broken").expect("write corrupt primary");
        std::fs::write(
            backup_path(&primary),
            serde_json::to_vec_pretty(&expected).expect("serialize backup"),
        )
        .expect("write backup");

        let loaded = load_settings_from_path(&primary)
            .expect("load settings")
            .expect("backup should load")
            .settings;
        assert_eq!(loaded.accent_color, expected.accent_color);
    }

    #[test]
    fn corrupt_locator_falls_back_to_locator_backup() {
        let dir = TestDir::new();
        let locator = dir.path().join("settings.json");
        let custom_dir = dir.path().join("custom");
        let backup = AppSettings {
            default_data_path: Some(custom_dir.to_string_lossy().into_owned()),
            ..AppSettings::default()
        };

        std::fs::write(&locator, "not json").expect("write corrupt locator");
        std::fs::write(
            backup_path(&locator),
            serde_json::to_vec_pretty(&backup).expect("serialize locator backup"),
        )
        .expect("write locator backup");

        assert_eq!(
            resolve_settings_file_path(&locator).expect("resolve settings path"),
            custom_dir.join("settings.json")
        );
        let repaired: AppSettings =
            serde_json::from_slice(&std::fs::read(&locator).expect("read repaired locator"))
                .expect("parse repaired locator");
        assert_eq!(repaired.default_data_path, backup.default_data_path);
    }
}
