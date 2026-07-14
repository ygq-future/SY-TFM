use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 运行平台。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    /// Windows
    Windows,
    /// macOS
    Macos,
    /// Linux
    Linux,
    /// iOS
    Ios,
    /// Android
    Android,
}
