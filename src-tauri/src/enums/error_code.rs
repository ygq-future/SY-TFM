use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 统一错误码（驱动前端错误处理）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    /// 连接失败
    ConnectionFailed,
    /// 认证失败
    AuthFailed,
    /// 未连接
    NotConnected,
    /// 连接超时
    ConnectionTimeout,
    /// 主机不可达
    HostUnreachable,
    /// 文件未找到
    FileNotFound,
    /// 权限拒绝
    PermissionDenied,
    /// 文件已存在
    FileAlreadyExists,
    /// 目录非空
    DirectoryNotEmpty,
    /// 协议错误
    ProtocolError,
    /// 不支持的操作
    UnsupportedOperation,
    /// 存储读取失败
    StorageReadFailed,
    /// 存储写入失败
    StorageWriteFailed,
    /// 解密失败
    CryptoDecryptFailed,
    /// 加密失败
    CryptoEncryptFailed,
    /// 会话未找到
    SessionNotFound,
    /// 会话过期
    SessionExpired,
    /// 操作已取消
    OperationCancelled,
    /// 操作超时
    OperationTimeout,
    /// 平台不支持
    PlatformUnsupported,
}
