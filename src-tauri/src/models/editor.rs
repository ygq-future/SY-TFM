//! 远程与在线编辑的数据模型。

use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::enums::ErrorCode;

/// 外部编辑会话启动结果。
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct RemoteEditSessionInfo {
    /// 编辑会话 ID。
    pub edit_session_id: Uuid,
    /// 交给系统默认编辑器打开的本地临时文件。
    pub local_path: String,
    /// 源文件名。
    pub file_name: String,
    /// 远程文件的完整路径。
    pub remote_path: String,
}

/// 在线编辑器读取到的远程文本及其内容版本。
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct RemoteTextSnapshot {
    /// UTF-8 文本内容。
    pub content: String,
    /// 远程文件原始字节的 SHA-256 指纹，用于保存前的乐观并发校验。
    pub revision: String,
}

/// 外部编辑器文件同步成功事件。
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct EditorSyncedPayload {
    /// 主机 ID。
    pub host_id: Uuid,
    /// 远程路径。
    pub file_path: String,
    /// 文件名。
    pub file_name: String,
    /// 本地格式化的同步时间。
    pub sync_time: String,
}

/// 外部编辑器同步失败事件。
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct EditorErrorPayload {
    /// 主机 ID。
    pub host_id: Uuid,
    /// 远程路径。
    pub file_path: String,
    /// 文件名。
    pub file_name: String,
    /// 统一错误码。
    pub code: ErrorCode,
    /// 可展示的错误描述。
    pub message: String,
}

/// 外部编辑会话失效事件。
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct EditorSessionInvalidPayload {
    /// 编辑会话 ID。
    pub edit_session_id: Uuid,
    /// 主机 ID。
    pub host_id: Uuid,
    /// 远程路径。
    pub file_path: String,
}
