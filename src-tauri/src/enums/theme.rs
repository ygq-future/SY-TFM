use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 主题模式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    /// 浅色
    Light,
    /// 深色
    Dark,
    /// 跟随系统
    #[default]
    System,
}
