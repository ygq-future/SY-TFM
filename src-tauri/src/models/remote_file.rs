use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 远程文件/目录条目。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct RemoteFile {
    /// 文件名
    pub name: String,
    /// 完整路径
    pub full_path: String,
    /// 字节数（目录为 0）
    #[ts(type = "number")]
    pub size: i64,
    /// 是否为目录
    pub is_directory: bool,
    /// 最后修改时间（ISO 8601）
    pub last_modified: String,
    /// 所有者信息 "owner:group"（WebDAV 可能返回 null）
    #[serde(default)]
    pub owner: Option<String>,
    /// 权限字符串 "rwxr-xr-x"（WebDAV 可能返回 null）
    #[serde(default)]
    pub permissions: Option<String>,
}

impl RemoteFile {
    /// 是否为 ".." 父目录条目。
    pub fn is_parent_entry(&self) -> bool {
        self.name == ".."
    }

    /// 创建 ".." 父目录条目。
    pub fn parent_entry(parent_path: String) -> Self {
        Self {
            name: "..".to_string(),
            full_path: parent_path,
            size: 0,
            is_directory: true,
            last_modified: String::new(),
            owner: None,
            permissions: None,
        }
    }
}
