use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 文件传输方向。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum TransferDirection {
    /// 本地 → 远程
    LocalToRemote,
    /// 远程 → 本地
    RemoteToLocal,
    /// 远程 → 远程（跨主机）
    RemoteToRemote,
}
