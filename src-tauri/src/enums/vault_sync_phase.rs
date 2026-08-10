use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 保险库同步生命周期阶段。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum VaultSyncPhase {
    /// 没有待上传变化，也没有正在运行的同步。
    Idle,
    /// 本机存在尚未确认写入云端的变化。
    Pending,
    /// 正在执行云端协调。
    Syncing,
    /// 最近一次同步失败。
    Failed,
}
