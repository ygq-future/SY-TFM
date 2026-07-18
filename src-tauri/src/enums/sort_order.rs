use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 排序方向。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum SortOrder {
    /// 升序
    Ascending,
    /// 降序
    Descending,
}
