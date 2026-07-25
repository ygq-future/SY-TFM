//! 配置迁移：v1（SY-FTP 明文）→ v2（SY-FTP 加密）→ v3（SY-TFM，当前）。
//!
//! 完整迁移逻辑见 `docs/04-data-model.md` §8。

use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::enums::Protocol;
use crate::error::AppError;
use crate::models::{AppSettings, RemoteHost};

/// 旧版 SY-FTP 配置文件中的主机条目（v1/v2 格式）。
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "PascalCase")]
struct LegacyFtpHost {
    name: String,
    host: String,
    port: u16,
    username: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    default_remote_path: Option<String>,
    #[serde(default)]
    tags: Option<String>,
}

/// 旧版 SY-FTP 配置文件根结构。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct LegacySettings {
    #[serde(default)]
    hosts: Vec<LegacyFtpHost>,
    #[serde(default)]
    theme: Option<String>,
    #[serde(default)]
    accent_color: Option<String>,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    default_download_path: Option<String>,
}

/// 从 v1/v2（旧版 SY-FTP）迁移到 v3（SY-TFM）。
///
/// 迁移规则：
/// 1. 端口推断协议：22→SFTP, 21→FTP, 443→WebDAV, 其余→FTP
/// 2. 密码先保留原值，`SettingsService::load` 会在落盘前统一加密明文
/// 3. 字段映射：DefaultRemotePath 丢弃（SY-TFM 不持久化运行时路径）
/// 4. config_version 设为 3
pub fn migrate_v1_to_v3(old_path: &Path, _new_path: &Path) -> Result<AppSettings, AppError> {
    let content = std::fs::read_to_string(old_path)?;
    let legacy: LegacySettings = serde_json::from_str(&content).map_err(|e| {
        AppError::new(
            crate::enums::ErrorCode::StorageReadFailed,
            format!("旧配置解析失败: {e}"),
        )
    })?;

    let mut hosts = Vec::with_capacity(legacy.hosts.len());
    for lh in legacy.hosts {
        let protocol = infer_protocol(lh.port);
        let host = RemoteHost {
            id: Uuid::new_v4(),
            name: lh.name,
            protocol,
            host: lh.host,
            port: lh.port,
            username: if lh.username.is_empty() {
                "anonymous".to_string()
            } else {
                lh.username
            },
            password: lh.password,
            tags: lh.tags.unwrap_or_default(),
            download_path: None,
            https: matches!(protocol, Protocol::WebDav),
            base_path: None,
            sftp_host_key_fingerprint: None,
            is_connected: false,
        };
        hosts.push(host);
    }

    let settings = AppSettings {
        theme: legacy
            .theme
            .as_deref()
            .map(|t| match t.to_lowercase().as_str() {
                "light" => crate::enums::Theme::Light,
                "dark" => crate::enums::Theme::Dark,
                _ => crate::enums::Theme::System,
            })
            .unwrap_or_default(),
        accent_color: legacy.accent_color.unwrap_or_else(|| "#2296F5".to_string()),
        language: legacy
            .language
            .as_deref()
            .map(|l| match l.to_lowercase().as_str() {
                "zh" | "chinese" => crate::enums::Language::Zh,
                _ => crate::enums::Language::En,
            })
            .unwrap_or_default(),
        font_size: 13,
        heading_font_size: 15,
        label_font_size: 12,
        caption_font_size: 11,
        data_font_size: 12,
        mobile_titlebar_height: 48,
        default_download_path: legacy.default_download_path,
        default_data_path: None,
        hosts,
        window_topmost: false,
        background_image_path: None,
        background_image_enabled: true,
        background_opacity: 0.3,
        glass_blur: 22.0,
        glass_opacity: 0.72,
        vault_sync: crate::models::VaultSyncSettings::default(),
        config_version: 3,
    };

    Ok(settings)
}

/// 根据端口推断协议。
fn infer_protocol(port: u16) -> Protocol {
    match port {
        22 => Protocol::Sftp,
        21 => Protocol::Ftp,
        443 | 5005 | 5006 => Protocol::WebDav,
        _ => Protocol::Ftp,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_protocol() {
        assert_eq!(infer_protocol(22), Protocol::Sftp);
        assert_eq!(infer_protocol(21), Protocol::Ftp);
        assert_eq!(infer_protocol(443), Protocol::WebDav);
        assert_eq!(infer_protocol(8080), Protocol::Ftp);
    }

    #[test]
    fn test_migrate_basic() {
        let json = r##"{
            "Hosts": [
                {
                    "Name": "测试SFTP",
                    "Host": "192.168.1.1",
                    "Port": 22,
                    "Username": "root",
                    "Password": "enc.v1:dGVzdA=="
                }
            ],
            "Theme": "dark",
            "AccentColor": "#FF0000",
            "Language": "zh"
        }"##;
        let tmp = std::env::temp_dir().join("sy-tfm-test-migrate.json");
        std::fs::write(&tmp, json).unwrap();

        let settings = migrate_v1_to_v3(&tmp, &tmp).expect("迁移应成功");
        assert_eq!(settings.config_version, 3);
        assert_eq!(settings.hosts.len(), 1);
        assert_eq!(settings.hosts[0].protocol, Protocol::Sftp);
        assert_eq!(settings.hosts[0].username, "root");
        assert_eq!(settings.hosts[0].password, "enc.v1:dGVzdA==");
        assert_eq!(settings.theme, crate::enums::Theme::Dark);
        assert_eq!(settings.language, crate::enums::Language::Zh);

        let _ = std::fs::remove_file(&tmp);
    }
}
