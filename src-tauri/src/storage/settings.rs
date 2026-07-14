//! 配置服务：读写 `settings.json`。

use std::path::PathBuf;

use directories::ProjectDirs;

use crate::enums::ErrorCode;
use crate::error::AppError;
use crate::models::AppSettings;

/// 应用配置服务。
pub struct SettingsService;

impl SettingsService {
    /// 加载配置。
    ///
    /// 文件不存在则返回默认值；损坏则回退默认值（最佳努力，不丢失主机列表由后续迁移保障）。
    pub fn load() -> Result<AppSettings, AppError> {
        let path = Self::settings_file_path()?;
        if !path.exists() {
            return Ok(AppSettings::default());
        }

        let content = std::fs::read_to_string(&path)?;
        match serde_json::from_str::<AppSettings>(&content) {
            Ok(mut settings) => {
                if settings.config_version < 3 {
                    // 低版本配置：触发迁移（Phase 0 占位，标记为当前版本）
                    settings.config_version = 3;
                }
                Ok(settings)
            }
            Err(_) => {
                // 配置损坏：回退默认值
                Ok(AppSettings::default())
            }
        }
    }

    /// 保存配置。
    pub fn save(settings: &AppSettings) -> Result<(), AppError> {
        let path = Self::settings_file_path()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(settings)?;
        std::fs::write(&path, json)?;
        Ok(())
    }

    /// 配置文件路径。
    pub fn settings_file_path() -> Result<PathBuf, AppError> {
        let proj = ProjectDirs::from("com", "sy", "SY-TFM").ok_or_else(|| {
            AppError::new(
                ErrorCode::PlatformUnsupported,
                "无法确定平台配置目录",
            )
        })?;
        Ok(proj.data_local_dir().join("settings.json"))
    }
}
