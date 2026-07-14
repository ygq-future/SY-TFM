use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::enums::Protocol;

/// 远程主机配置（替代旧版 FtpHost，支持多种协议）。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct RemoteHost {
    /// 唯一标识符
    pub id: Uuid,
    /// 显示名称
    pub name: String,
    /// 协议类型（用户显式选择，不再通过端口推断）
    #[serde(default = "default_protocol")]
    pub protocol: Protocol,
    /// 主机地址（IP 或域名）
    pub host: String,
    /// 端口号（0 = 使用协议默认端口）
    #[serde(default)]
    pub port: u16,
    /// 用户名（默认 "anonymous"）
    #[serde(default = "default_username")]
    pub username: String,
    /// 加密后的密码（`enc.v1:` 前缀 + Base64）
    #[serde(default)]
    pub password: String,
    /// 标签（逗号分隔字符串，如 "prod,web,server1"）
    #[serde(default)]
    pub tags: String,
    /// 每主机下载路径覆盖（null = 使用全局默认）
    #[serde(default)]
    pub download_path: Option<String>,
    /// WebDAV 专用：是否使用 HTTPS
    #[serde(default = "default_https")]
    pub https: bool,
    /// WebDAV 专用：基础路径前缀（如 "/remote.php/dav/files/user"）
    #[serde(default)]
    pub base_path: Option<String>,
    /// 运行时连接状态（不持久化）
    #[serde(skip)]
    pub is_connected: bool,
}

/// 默认协议。
fn default_protocol() -> Protocol {
    Protocol::Sftp
}

/// 默认用户名。
fn default_username() -> String {
    "anonymous".to_string()
}

/// 默认 HTTPS。
fn default_https() -> bool {
    true
}

impl RemoteHost {
    /// 解析标签为列表。
    pub fn tag_list(&self) -> Vec<String> {
        if self.tags.trim().is_empty() {
            return vec![];
        }
        self.tags
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// 克隆配置（不含运行时状态，生成新 ID）。
    pub fn clone_config(&self) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: self.name.clone(),
            protocol: self.protocol,
            host: self.host.clone(),
            port: self.port,
            username: self.username.clone(),
            password: self.password.clone(),
            tags: self.tags.clone(),
            download_path: self.download_path.clone(),
            https: self.https,
            base_path: self.base_path.clone(),
            is_connected: false,
        }
    }

    /// 获取有效端口（0 = 使用协议默认端口）。
    pub fn effective_port(&self) -> u16 {
        if self.port == 0 {
            self.protocol.default_port()
        } else {
            self.port
        }
    }
}
