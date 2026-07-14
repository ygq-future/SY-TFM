use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::enums::{Language, Theme};

use super::remote_host::RemoteHost;

/// 应用配置（settings.json 的内存表示）。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 主题
    #[serde(default = "default_theme")]
    pub theme: Theme,
    /// 强调色 HEX
    #[serde(default = "default_accent")]
    pub accent_color: String,
    /// 语言
    #[serde(default = "default_language")]
    pub language: Language,
    /// 默认下载路径（null = 使用平台默认）
    #[serde(default)]
    pub default_download_path: Option<String>,
    /// 默认数据路径（null = 使用平台默认）
    #[serde(default)]
    pub default_data_path: Option<String>,
    /// 主机列表
    #[serde(default)]
    pub hosts: Vec<RemoteHost>,
    /// 窗口置顶（桌面端）
    #[serde(default)]
    pub window_topmost: bool,
    /// 背景图片路径（桌面端）
    #[serde(default)]
    pub background_image_path: Option<String>,
    /// 背景图片不透明度 (0.1 - 1.0)
    #[serde(default = "default_bg_opacity")]
    pub background_opacity: f64,
    /// 配置版本号（用于迁移）
    #[serde(default = "default_config_version")]
    pub config_version: u32,
}

/// 默认主题。
fn default_theme() -> Theme {
    Theme::System
}

/// 默认强调色。
fn default_accent() -> String {
    "#2296F5".to_string()
}

/// 默认语言。
fn default_language() -> Language {
    Language::En
}

/// 默认背景不透明度。
fn default_bg_opacity() -> f64 {
    0.3
}

/// 默认配置版本号。
fn default_config_version() -> u32 {
    3
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            accent_color: default_accent(),
            language: default_language(),
            default_download_path: None,
            default_data_path: None,
            hosts: vec![],
            window_topmost: false,
            background_image_path: None,
            background_opacity: default_bg_opacity(),
            config_version: default_config_version(),
        }
    }
}
