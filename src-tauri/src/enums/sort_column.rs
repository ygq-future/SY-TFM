use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 文件列表排序列。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum SortColumn {
    /// 名称
    Name,
    /// 大小
    Size,
    /// 修改时间
    LastModified,
    /// 所有者
    Owner,
    /// 权限
    Permissions,
}
