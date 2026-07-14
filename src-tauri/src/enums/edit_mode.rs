use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 远程文件编辑模式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum EditMode {
    /// 外部编辑器
    External,
    /// 在线编辑器
    Online,
}
