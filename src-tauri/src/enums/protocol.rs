use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 支持的远程文件传输协议。
///
/// 新增协议时：
/// 1. 在此枚举添加变体；
/// 2. 在 `transport/` 目录新建 adapter 文件；
/// 3. 在 `create_adapter()` 工厂函数注册。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    /// SFTP - SSH File Transfer Protocol
    Sftp,
    /// WebDAV - Web Distributed Authoring and Versioning
    WebDav,
    /// FTP / FTPS - File Transfer Protocol（后续迭代）
    Ftp,
    /// Amazon S3 兼容存储（后续迭代）
    S3,
    /// SCP - Secure Copy Protocol（后续迭代）
    Scp,
}

impl Protocol {
    /// 获取协议默认端口。
    pub fn default_port(&self) -> u16 {
        match self {
            Protocol::Sftp => 22,
            Protocol::WebDav => 443,
            Protocol::Ftp => 21,
            Protocol::S3 => 443,
            Protocol::Scp => 22,
        }
    }

    /// 是否支持 TLS/SSL。
    pub fn supports_tls(&self) -> bool {
        matches!(
            self,
            Protocol::Sftp | Protocol::WebDav | Protocol::Ftp | Protocol::S3
        )
    }

    /// 是否在当前版本已实现。
    pub fn is_available(&self) -> bool {
        matches!(self, Protocol::Sftp | Protocol::WebDav)
    }
}
