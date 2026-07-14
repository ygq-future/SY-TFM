//! 统一错误类型。
//!
//! 对外可见错误统一为 [`AppError`]，由 Tauri 自动序列化到前端。
//! 禁止抛裸字符串或未经 [`crate::enums::ErrorCode`] 包裹的错误。

use crate::enums::ErrorCode;

/// 应用级错误：统一前端可见错误。
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    /// 错误码
    pub code: ErrorCode,
    /// 错误信息
    pub message: String,
    /// 附加详情（可选）
    pub details: Option<serde_json::Value>,
}

impl AppError {
    /// 创建新错误。
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    /// 附加详情。
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

// 便捷构造
impl AppError {
    /// 未连接错误。
    pub fn not_connected() -> Self {
        Self::new(ErrorCode::NotConnected, "Not connected to host")
    }

    /// 会话未找到错误。
    pub fn session_not_found(id: impl std::fmt::Display) -> Self {
        Self::new(ErrorCode::SessionNotFound, format!("Session not found: {id}"))
    }

    /// 连接失败错误。
    pub fn connection_failed(msg: impl Into<String>) -> Self {
        Self::new(ErrorCode::ConnectionFailed, msg)
    }

    /// 协议错误。
    pub fn protocol_error(msg: impl Into<String>) -> Self {
        Self::new(ErrorCode::ProtocolError, msg)
    }

    /// 不支持的操作错误。
    pub fn unsupported(msg: impl Into<String>) -> Self {
        Self::new(ErrorCode::UnsupportedOperation, msg)
    }
}

// 透明转换：使 `?` 可在 storage / migration 等处直接传播底层错误。
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::new(ErrorCode::StorageReadFailed, e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::new(ErrorCode::StorageReadFailed, e.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        Self::new(ErrorCode::ProtocolError, e.to_string())
    }
}
