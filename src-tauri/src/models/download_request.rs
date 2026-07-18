use serde::Deserialize;
use ts_rs::TS;

/// 下载命令请求参数。
#[derive(Debug, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    /// 主机 ID。
    pub host_id: String,
    /// 远程文件或目录路径。
    pub remote_path: String,
    /// 本地目标基目录。
    pub local_directory: String,
    /// 未经本地路径拼接的原始文件名。
    pub local_name: String,
    /// 是否为目录。
    pub is_directory: bool,
    /// 前端创建的传输操作 ID。
    pub operation_id: String,
}
