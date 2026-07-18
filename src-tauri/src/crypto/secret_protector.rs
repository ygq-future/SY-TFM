//! 密码加密：AES-256-GCM。
//!
//! 存储格式：`enc.v1:<Base64(nonce(12B) || ciphertext || tag(16B))>`（见 AGENTS.md §5）。

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::enums::ErrorCode;
use crate::error::AppError;

/// 加密数据前缀。
pub const ENCRYPTED_PREFIX: &str = "enc.v1:";

/// AES-256-GCM 密钥长度。
const KEY_LEN: usize = 32;

/// GCM nonce 长度。
const NONCE_LEN: usize = 12;

/// 密码加解密器（AES-256-GCM）。
pub struct SecretProtector {
    key: [u8; KEY_LEN],
}

impl SecretProtector {
    /// 使用 32 字节主密钥创建加解密器。
    pub fn new(key: [u8; KEY_LEN]) -> Self {
        Self { key }
    }

    /// 加密明文，返回 `enc.v1:<Base64(...)>` 格式字符串。
    pub fn encrypt(&self, plaintext: &str) -> Result<String, AppError> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| AppError::new(ErrorCode::CryptoEncryptFailed, e.to_string()))?;

        let mut rng = OsRng;
        let nonce = Aes256Gcm::generate_nonce(&mut rng);

        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| AppError::new(ErrorCode::CryptoEncryptFailed, e.to_string()))?;

        let mut buf = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        buf.extend_from_slice(nonce.as_slice());
        buf.extend_from_slice(&ciphertext);

        Ok(format!("{ENCRYPTED_PREFIX}{}", STANDARD.encode(&buf)))
    }

    /// 解密 `enc.v1:<Base64(...)>` 格式字符串，返回明文。
    pub fn decrypt(&self, payload: &str) -> Result<String, AppError> {
        let data = payload
            .strip_prefix(ENCRYPTED_PREFIX)
            .ok_or_else(|| AppError::new(ErrorCode::CryptoDecryptFailed, "缺少 enc.v1: 前缀"))?;

        let decoded = STANDARD
            .decode(data)
            .map_err(|e| AppError::new(ErrorCode::CryptoDecryptFailed, e.to_string()))?;

        if decoded.len() < NONCE_LEN {
            return Err(AppError::new(
                ErrorCode::CryptoDecryptFailed,
                "密文长度不足",
            ));
        }

        let (nonce_bytes, ciphertext) = decoded.split_at(NONCE_LEN);
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| AppError::new(ErrorCode::CryptoDecryptFailed, e.to_string()))?;

        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| {
                AppError::new(
                    ErrorCode::CryptoDecryptFailed,
                    "已保存的密码无法解密，系统密钥可能已变化或配置来自其他设备。请编辑该主机并重新输入密码。",
                )
            })?;

        String::from_utf8(plaintext)
            .map_err(|e| AppError::new(ErrorCode::CryptoDecryptFailed, e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = [0x42u8; KEY_LEN];
        let protector = SecretProtector::new(key);

        let plaintext = "hello 世界 / p@ssw0rd!";
        let encrypted = protector.encrypt(plaintext).expect("加密应成功");

        assert!(
            encrypted.starts_with(ENCRYPTED_PREFIX),
            "密文应带 enc.v1: 前缀"
        );

        let decrypted = protector.decrypt(&encrypted).expect("解密应成功");
        assert_eq!(decrypted, plaintext, "解密结果应与明文一致");
    }

    #[test]
    fn decrypt_invalid_prefix_fails() {
        let key = [0x42u8; KEY_LEN];
        let protector = SecretProtector::new(key);

        let result = protector.decrypt("not-a-valid-payload");
        assert!(result.is_err(), "无前缀的密文应解密失败");
    }

    #[test]
    fn decrypt_with_changed_key_returns_actionable_message() {
        let encrypted = SecretProtector::new([0x42u8; KEY_LEN])
            .encrypt("saved-password")
            .expect("加密应成功");

        let error = SecretProtector::new([0x24u8; KEY_LEN])
            .decrypt(&encrypted)
            .expect_err("不同密钥必须解密失败");

        assert_eq!(error.code, ErrorCode::CryptoDecryptFailed);
        assert!(error.message.contains("重新输入密码"));
        assert!(!error.message.contains("aead::Error"));
    }

    #[test]
    fn encrypt_produces_different_ciphertext() {
        let key = [0x42u8; KEY_LEN];
        let protector = SecretProtector::new(key);

        let plaintext = "same-input";
        let a = protector.encrypt(plaintext).expect("加密应成功");
        let b = protector.encrypt(plaintext).expect("加密应成功");

        assert_ne!(a, b, "随机 nonce 应使每次密文不同");
        assert_eq!(
            protector.decrypt(&a).expect("解密应成功"),
            protector.decrypt(&b).expect("解密应成功")
        );
    }
}
