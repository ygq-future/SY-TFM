use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 远程主机上的收藏文件夹。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct FavoriteFolder {
    /// 在收藏列表中显示的文件夹名称。
    pub name: String,
    /// 远程文件夹的完整路径。
    pub path: String,
}
