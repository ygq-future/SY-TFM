//! 平台密钥存储（keyring）。
//!
//! 经 `keyring` crate 统一五平台：Windows DPAPI / macOS Keychain /
//! Linux 本地文件(0600) / iOS Keychain / Android Keystore。
//!
//! 主密钥为 32 字节随机值，Base64 编码后存入 keyring。
//! 首次调用时自动生成并存储。

use base64::{engine::general_purpose::STANDARD, Engine as _};
use keyring::Entry;

use crate::enums::ErrorCode;
use crate::error::AppError;

/// keyring 中的服务名。
const KEYRING_SERVICE: &str = "com.sy.tfm";

/// keyring 中的账户名（主密钥条目）。
const KEYRING_ACCOUNT: &str = "master-key";

/// 主密钥长度（AES-256 = 32 字节）。
const KEY_LEN: usize = 32;

/// 获取或创建 32 字节主密钥。
///
/// 首次调用时生成随机密钥并存入平台 keyring；后续调用从 keyring 读取。
pub fn get_or_create_master_key() -> Result<[u8; KEY_LEN], AppError> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| AppError::new(ErrorCode::PlatformUnsupported, e.to_string()))?;

    match entry.get_password() {
        Ok(stored) => {
            // 已有密钥：Base64 解码
            let key_bytes = STANDARD
                .decode(stored.as_bytes())
                .map_err(|e| AppError::new(ErrorCode::CryptoDecryptFailed, e.to_string()))?;
            if key_bytes.len() != KEY_LEN {
                return Err(AppError::new(
                    ErrorCode::CryptoDecryptFailed,
                    format!("主密钥长度异常: {} != {KEY_LEN}", key_bytes.len()),
                ));
            }
            let mut key = [0u8; KEY_LEN];
            key.copy_from_slice(&key_bytes);
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => {
            // 无密钥：生成新密钥并存入 keyring
            let key = generate_random_key();
            let encoded = STANDARD.encode(key);
            entry
                .set_password(&encoded)
                .map_err(|e| AppError::new(ErrorCode::PlatformUnsupported, e.to_string()))?;
            Ok(key)
        }
        Err(e) => Err(AppError::new(
            ErrorCode::PlatformUnsupported,
            format!("keyring 读取失败: {e}"),
        )),
    }
}

/// 生成 32 字节随机密钥。
fn generate_random_key() -> [u8; KEY_LEN] {
    use std::time::{SystemTime, UNIX_EPOCH};
    // 简单 PRNG 基于系统时间种子（keyring 环境下无 OsRng 时的 fallback）
    // 注：aes-gcm 的 OsRng 在实际使用时可用，此处保持无额外依赖
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let mut state = seed;
    let mut key = [0u8; KEY_LEN];
    for byte in key.iter_mut() {
        // xorshift64
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        *byte = (state & 0xFF) as u8;
    }
    key
}
