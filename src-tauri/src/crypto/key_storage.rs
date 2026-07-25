//! 平台密钥存储。
//!
//! Windows / macOS / Linux / iOS 使用 `keyring` 原生后端；Android 使用
//! 项目内原生插件调用 Android Keystore。
//!
//! 主密钥为 32 字节随机值，Base64 编码后存入对应平台安全存储。
//! 首次调用时自动生成并存储。

use aes_gcm::aead::{rand_core::RngCore, OsRng};
use base64::{engine::general_purpose::STANDARD, Engine as _};
#[cfg(not(target_os = "android"))]
use keyring::Entry;

use crate::enums::vault_policy::VAULT_KEY_BYTES;
use crate::enums::vault_resource::VaultResource;
use crate::enums::ErrorCode;
use crate::error::AppError;

/// 主密钥长度（AES-256 = 32 字节）。
const KEY_LEN: usize = 32;

/// 获取或创建 32 字节主密钥。
///
/// 首次调用时生成随机密钥并存入平台安全存储；后续调用读取同一密钥。
pub fn get_or_create_master_key() -> Result<[u8; KEY_LEN], AppError> {
    match get_secret(VaultResource::MasterKeyAccount.as_str())? {
        Some(stored) => decode_master_key(&stored),
        None => {
            // 无密钥：生成新密钥并存入平台安全存储。
            let key = generate_random_key();
            let encoded = STANDARD.encode(key);
            set_secret(VaultResource::MasterKeyAccount.as_str(), &encoded)?;
            let persisted =
                get_secret(VaultResource::MasterKeyAccount.as_str())?.ok_or_else(|| {
                    AppError::new(ErrorCode::PlatformUnsupported, "主密钥写入后无法读取")
                })?;
            let persisted_key = decode_master_key(&persisted)?;
            if persisted_key != key {
                return Err(AppError::new(
                    ErrorCode::CryptoEncryptFailed,
                    "系统凭据存储未能稳定保存主密钥",
                ));
            }
            Ok(persisted_key)
        }
    }
}

/// 读取当前设备缓存的跨设备 Vault Key。
pub fn get_vault_key() -> Result<Option<[u8; VAULT_KEY_BYTES]>, AppError> {
    get_secret(VaultResource::KeyringAccount.as_str())?
        .map(|stored| decode_fixed_key::<VAULT_KEY_BYTES>(&stored))
        .transpose()
}

/// 将跨设备 Vault Key 缓存在当前设备的系统凭据库中。
pub fn store_vault_key(key: &[u8; VAULT_KEY_BYTES]) -> Result<(), AppError> {
    set_secret(
        VaultResource::KeyringAccount.as_str(),
        &STANDARD.encode(key),
    )?;
    let persisted = get_secret(VaultResource::KeyringAccount.as_str())?
        .ok_or_else(|| AppError::new(ErrorCode::PlatformUnsupported, "Vault Key 写入后无法读取"))?;
    if decode_fixed_key::<VAULT_KEY_BYTES>(&persisted)? != *key {
        return Err(AppError::new(
            ErrorCode::CryptoEncryptFailed,
            "系统凭据库未能稳定保存 Vault Key",
        ));
    }
    Ok(())
}

/// 从当前设备的系统凭据库移除 Vault Key。
pub fn delete_vault_key() -> Result<(), AppError> {
    delete_secret(VaultResource::KeyringAccount.as_str())
}

#[cfg(target_os = "android")]
fn get_secret(account: &str) -> Result<Option<String>, AppError> {
    sy_tfm_secure_storage::get(account)
        .map_err(|error| AppError::new(ErrorCode::PlatformUnsupported, error.to_string()))
}

#[cfg(target_os = "android")]
fn set_secret(account: &str, value: &str) -> Result<(), AppError> {
    sy_tfm_secure_storage::set(account, value)
        .map_err(|error| AppError::new(ErrorCode::PlatformUnsupported, error.to_string()))
}

#[cfg(target_os = "android")]
fn delete_secret(account: &str) -> Result<(), AppError> {
    sy_tfm_secure_storage::delete(account)
        .map_err(|error| AppError::new(ErrorCode::PlatformUnsupported, error.to_string()))
}

#[cfg(not(target_os = "android"))]
fn get_secret(account: &str) -> Result<Option<String>, AppError> {
    let entry = Entry::new(VaultResource::KeyringService.as_str(), account)
        .map_err(|error| AppError::new(ErrorCode::PlatformUnsupported, error.to_string()))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AppError::new(
            ErrorCode::PlatformUnsupported,
            error.to_string(),
        )),
    }
}

#[cfg(not(target_os = "android"))]
fn set_secret(account: &str, value: &str) -> Result<(), AppError> {
    Entry::new(VaultResource::KeyringService.as_str(), account)
        .and_then(|entry| entry.set_password(value))
        .map_err(|error| AppError::new(ErrorCode::PlatformUnsupported, error.to_string()))
}

#[cfg(not(target_os = "android"))]
fn delete_secret(account: &str) -> Result<(), AppError> {
    let entry = Entry::new(VaultResource::KeyringService.as_str(), account)
        .map_err(|error| AppError::new(ErrorCode::PlatformUnsupported, error.to_string()))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(AppError::new(
            ErrorCode::PlatformUnsupported,
            error.to_string(),
        )),
    }
}

/// 解码并校验平台凭据存储中的主密钥。
fn decode_master_key(stored: &str) -> Result<[u8; KEY_LEN], AppError> {
    decode_fixed_key::<KEY_LEN>(stored)
}

fn decode_fixed_key<const N: usize>(stored: &str) -> Result<[u8; N], AppError> {
    let key_bytes = STANDARD
        .decode(stored.as_bytes())
        .map_err(|error| AppError::new(ErrorCode::CryptoDecryptFailed, error.to_string()))?;
    if key_bytes.len() != N {
        return Err(AppError::new(
            ErrorCode::CryptoDecryptFailed,
            format!("密钥长度异常: {} != {N}", key_bytes.len()),
        ));
    }
    let mut key = [0_u8; N];
    key.copy_from_slice(&key_bytes);
    Ok(key)
}

/// 生成 32 字节随机密钥。
fn generate_random_key() -> [u8; KEY_LEN] {
    let mut key = [0u8; KEY_LEN];
    OsRng.fill_bytes(&mut key);
    key
}
