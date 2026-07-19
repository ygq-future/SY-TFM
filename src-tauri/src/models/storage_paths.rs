use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 当前平台解析后的默认存储路径。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct StoragePaths {
    /// 操作系统的默认下载目录。
    pub default_download_path: String,
    /// SY-TFM 默认应用数据目录。
    pub default_data_path: String,
    /// 当前副本是否由便携模式标记启动。
    pub portable_mode: bool,
}
