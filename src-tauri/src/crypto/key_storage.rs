//! 平台密钥存储（keyring）。
//!
//! 经 `keyring` crate 统一五平台：Windows DPAPI / macOS Keychain /
//! Linux 本地文件(0600) / iOS Keychain / Android Keystore（Phase 1 任务 0.9 完善）。

use crate::enums::ErrorCode;
use crate::error::AppError;

/// keyring 中的服务名。
const KEYRING_SERVICE: &str = "com.sy.tfm";

/// keyring 中的账户名（主密钥条目）。
const KEYRING_ACCOUNT: &str = "master-key";

/// 获取或创建 32 字节主密钥（Phase 1 实现）。
pub fn get_or_create_master_key() -> Result<[u8; 32], AppError> {
    Err(AppError::new(
        ErrorCode::PlatformUnsupported,
        format!("key_storage 尚未实现（Phase 1 任务 0.9）: {KEYRING_SERVICE}/{KEYRING_ACCOUNT}"),
    ))
}
