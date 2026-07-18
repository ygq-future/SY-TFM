use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 连接状态。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    /// 连接中
    Connecting,
    /// 已连接
    Connected,
    /// 断开中
    Disconnecting,
    /// 已断开
    Disconnected,
    /// 重连中
    Reconnecting,
    /// 错误
    Error,
}
