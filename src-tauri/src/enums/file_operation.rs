use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 文件操作类型。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum FileOperation {
    /// 下载
    Download,
    /// 上传
    Upload,
    /// 删除
    Delete,
    /// 移动
    Move,
    /// 重命名
    Rename,
    /// 创建目录
    CreateDirectory,
    /// 创建文件
    CreateFile,
    /// 跨主机传输
    Transfer,
}
