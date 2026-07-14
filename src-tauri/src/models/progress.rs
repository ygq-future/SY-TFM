use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::enums::ConnectionStatus;

/// 单文件传输进度事件数据。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    /// 主机 ID
    pub host_id: Uuid,
    /// 操作 ID
    pub operation_id: String,
    /// 已传输字节数
    pub transferred: u64,
    /// 总字节数
    pub total: u64,
    /// 进度百分比
    pub percent: f64,
    /// 传输速度（字节/秒）
    pub speed: f64,
    /// 当前文件名
    pub current_file: String,
}

/// 批量传输进度事件数据。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct BatchProgressPayload {
    /// 主机 ID
    pub host_id: Uuid,
    /// 操作 ID
    pub operation_id: String,
    /// 当前索引
    pub current_index: usize,
    /// 总数
    pub total_count: usize,
    /// 当前文件名
    pub current_file: String,
    /// 当前文件进度百分比
    pub file_percent: f64,
}

/// 连接状态变更事件数据。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatusPayload {
    /// 主机 ID
    pub host_id: Uuid,
    /// 连接状态
    pub status: ConnectionStatus,
    /// 附加消息
    pub message: Option<String>,
}
