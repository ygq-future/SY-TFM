use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// WebDAV 连接使用的 HTTP scheme。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum HttpScheme {
    /// 明文 HTTP。
    Http,
    /// TLS 加密的 HTTPS。
    Https,
}
