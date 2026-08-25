use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Tauri 窗口用途标识。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "kebab-case")]
pub enum AppWindow {
    /// 文件管理主窗口。
    Main,
    /// 独立在线编辑器窗口。
    Editor,
}
