use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 界面语言。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Language {
    /// 英文
    #[default]
    En,
    /// 中文
    Zh,
}
