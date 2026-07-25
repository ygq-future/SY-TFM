use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::enums::{Language, Theme};

use super::remote_host::RemoteHost;
use super::vault_sync::VaultSyncSettings;

/// 应用配置（settings.json 的内存表示）。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 主题
    #[serde(default = "default_theme")]
    pub theme: Theme,
    /// 强调色方案标识。
    #[serde(default = "default_accent")]
    pub accent_color: String,
    /// 语言
    #[serde(default = "default_language")]
    pub language: Language,
    /// 界面基础字号（像素）。
    #[serde(default = "default_font_size")]
    pub font_size: u8,
    /// 标题文字字号（像素）。
    #[serde(default = "default_heading_font_size")]
    pub heading_font_size: u8,
    /// 标签与表头字号（像素）。
    #[serde(default = "default_label_font_size")]
    pub label_font_size: u8,
    /// 提示与说明文字字号（像素）。
    #[serde(default = "default_caption_font_size")]
    pub caption_font_size: u8,
    /// 文件元数据与状态数据字号（像素）。
    #[serde(default = "default_data_font_size")]
    pub data_font_size: u8,
    /// Android 应用标题栏内容高度（不含系统安全区，像素）。
    #[serde(default = "default_mobile_titlebar_height")]
    pub mobile_titlebar_height: u8,
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
    /// 背景图片路径或 Data URL（桌面端）。
    #[serde(default)]
    pub background_image_path: Option<String>,
    /// 是否启用已保存的背景图片。
    #[serde(default = "default_background_enabled")]
    pub background_image_enabled: bool,
    /// 背景图片不透明度 (0.1 - 1.0)
    #[serde(default = "default_bg_opacity")]
    pub background_opacity: f64,
    /// 全局毛玻璃模糊半径（像素）。
    #[serde(default = "default_glass_blur")]
    pub glass_blur: f64,
    /// 全局毛玻璃表面不透明度。
    #[serde(default = "default_glass_opacity")]
    pub glass_opacity: f64,
    /// 跨设备加密保险库与 WebDAV 同步配置。
    #[serde(default)]
    pub vault_sync: VaultSyncSettings,
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
    "violet".to_string()
}

/// 默认语言。
fn default_language() -> Language {
    Language::En
}

/// 默认界面基础字号。
fn default_font_size() -> u8 {
    platform_typography_defaults().font_size
}

/// 默认标题字号。
fn default_heading_font_size() -> u8 {
    platform_typography_defaults().heading_font_size
}

/// 默认标签字号。
fn default_label_font_size() -> u8 {
    platform_typography_defaults().label_font_size
}

/// 默认提示字号。
fn default_caption_font_size() -> u8 {
    platform_typography_defaults().caption_font_size
}

/// 默认数据字号。
fn default_data_font_size() -> u8 {
    platform_typography_defaults().data_font_size
}

/// 默认 Android 应用标题栏内容高度。
fn default_mobile_titlebar_height() -> u8 {
    48
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TypographyDefaults {
    font_size: u8,
    heading_font_size: u8,
    label_font_size: u8,
    caption_font_size: u8,
    data_font_size: u8,
}

const fn typography_defaults(is_android: bool) -> TypographyDefaults {
    if is_android {
        TypographyDefaults {
            font_size: 15,
            heading_font_size: 20,
            label_font_size: 14,
            caption_font_size: 11,
            data_font_size: 13,
        }
    } else {
        TypographyDefaults {
            font_size: 13,
            heading_font_size: 15,
            label_font_size: 12,
            caption_font_size: 11,
            data_font_size: 12,
        }
    }
}

fn platform_typography_defaults() -> TypographyDefaults {
    typography_defaults(cfg!(target_os = "android"))
}

/// 默认背景不透明度。
fn default_bg_opacity() -> f64 {
    0.3
}

/// 默认启用已配置的背景图片。
fn default_background_enabled() -> bool {
    true
}

/// 默认毛玻璃模糊半径。
fn default_glass_blur() -> f64 {
    22.0
}

/// 默认毛玻璃不透明度。
fn default_glass_opacity() -> f64 {
    0.72
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
            font_size: default_font_size(),
            heading_font_size: default_heading_font_size(),
            label_font_size: default_label_font_size(),
            caption_font_size: default_caption_font_size(),
            data_font_size: default_data_font_size(),
            mobile_titlebar_height: default_mobile_titlebar_height(),
            default_download_path: None,
            default_data_path: None,
            hosts: vec![],
            window_topmost: false,
            background_image_path: None,
            background_image_enabled: default_background_enabled(),
            background_opacity: default_bg_opacity(),
            glass_blur: default_glass_blur(),
            glass_opacity: default_glass_opacity(),
            vault_sync: VaultSyncSettings::default(),
            config_version: default_config_version(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{typography_defaults, AppSettings};

    #[test]
    fn typography_defaults_are_platform_specific() {
        let desktop = typography_defaults(false);
        let android = typography_defaults(true);

        assert_eq!(
            (
                desktop.font_size,
                desktop.heading_font_size,
                desktop.label_font_size,
                desktop.caption_font_size,
                desktop.data_font_size,
            ),
            (13, 15, 12, 11, 12),
        );
        assert_eq!(
            (
                android.font_size,
                android.heading_font_size,
                android.label_font_size,
                android.caption_font_size,
                android.data_font_size,
            ),
            (15, 20, 14, 11, 13),
        );
    }

    #[test]
    fn android_titlebar_height_has_a_backward_compatible_default() {
        let settings: AppSettings =
            serde_json::from_str("{}").expect("settings should deserialize");

        assert_eq!(settings.mobile_titlebar_height, 48);
    }
}
