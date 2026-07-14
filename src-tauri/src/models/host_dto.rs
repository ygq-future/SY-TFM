use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::enums::Protocol;

/// 主机传输对象（用于配置导入/导出，绕过机器特定加密）。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct HostDto {
    /// 显示名称
    pub name: String,
    /// 协议类型
    pub protocol: Protocol,
    /// 主机地址
    pub host: String,
    /// 端口号
    pub port: u16,
    /// 用户名
    pub username: String,
    /// 密码（导出时不包含）
    #[serde(skip_serializing)]
    pub password: Option<String>,
    /// 标签
    pub tags: String,
    /// 下载路径覆盖
    pub download_path: Option<String>,
    /// 是否使用 HTTPS
    pub https: bool,
    /// 基础路径前缀
    pub base_path: Option<String>,
}

impl From<crate::models::RemoteHost> for HostDto {
    fn from(h: crate::models::RemoteHost) -> Self {
        Self {
            name: h.name,
            protocol: h.protocol,
            host: h.host,
            port: h.port,
            username: h.username,
            password: if h.password.is_empty() {
                None
            } else {
                Some("[PROTECTED]".to_string())
            },
            tags: h.tags,
            download_path: h.download_path,
            https: h.https,
            base_path: h.base_path,
        }
    }
}
