//! 跨设备配置保险库：Argon2id 包装 Vault Key，AES-256-GCM 保护配置载荷。

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use aes_gcm::Aes256Gcm;
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

use crate::enums::vault_policy::{VaultPolicy, VAULT_KEY_BYTES};
use crate::enums::vault_resource::VaultResource;
use crate::enums::ErrorCode;
use crate::error::AppError;
use crate::models::{VaultKdfParameters, VaultKeyEnvelope};

/// 可在设备间传输的 256 位保险库密钥。
pub type VaultKey = [u8; VAULT_KEY_BYTES];

/// 使用备份密码从公开密钥信封中解锁 Vault Key。
pub fn unlock_vault_key(
    envelope: &VaultKeyEnvelope,
    backup_password: &str,
    vault_id: &str,
) -> Result<VaultKey, AppError> {
    unwrap_key(envelope, backup_password, vault_id)
}

/// WebDAV 与本地文件共同使用的保险库文档。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableVaultDocument {
    /// 格式版本标识。
    pub format: String,
    /// 保险库稳定 ID。
    pub vault_id: String,
    /// 单调递增版本号。
    pub revision: u64,
    /// 最近更新时间（RFC 3339）。
    pub updated_at: String,
    /// 用户备份密码保护的 Vault Key。
    pub key_envelope: VaultKeyEnvelope,
    /// Base64 编码的载荷 nonce。
    pub payload_nonce: String,
    /// Base64 编码的加密配置载荷。
    pub ciphertext: String,
}

impl PortableVaultDocument {
    /// 创建新保险库并返回需要缓存在本机凭据库中的 Vault Key。
    pub fn create(
        plaintext: &[u8],
        backup_password: &str,
        vault_id: String,
        revision: u64,
    ) -> Result<(Self, VaultKey), AppError> {
        validate_backup_password(backup_password)?;
        let key = generate_key();
        let envelope = wrap_vault_key(&key, backup_password, &vault_id)?;
        let document = Self::encrypt(plaintext, key, vault_id, revision, envelope)?;
        Ok((document, key))
    }

    /// 使用已缓存的 Vault Key 和原密钥信封生成新 revision。
    pub fn encrypt(
        plaintext: &[u8],
        key: VaultKey,
        vault_id: String,
        revision: u64,
        key_envelope: VaultKeyEnvelope,
    ) -> Result<Self, AppError> {
        let aad = payload_aad(&vault_id, revision);
        let (payload_nonce, ciphertext) = encrypt_bytes(&key, plaintext, aad.as_bytes())?;
        Ok(Self {
            format: VaultResource::Format.as_str().to_string(),
            vault_id,
            revision,
            updated_at: chrono::Utc::now().to_rfc3339(),
            key_envelope,
            payload_nonce,
            ciphertext,
        })
    }

    /// 使用备份密码解锁 Vault Key 并解密配置载荷。
    pub fn decrypt_with_password(
        &self,
        backup_password: &str,
    ) -> Result<(Vec<u8>, VaultKey), AppError> {
        self.validate_format()?;
        let key = unwrap_key(&self.key_envelope, backup_password, &self.vault_id)?;
        let plaintext = self.decrypt_with_key(&key)?;
        Ok((plaintext, key))
    }

    /// 使用本机凭据库缓存的 Vault Key 解密配置载荷。
    pub fn decrypt_with_key(&self, key: &VaultKey) -> Result<Vec<u8>, AppError> {
        self.validate_format()?;
        let aad = payload_aad(&self.vault_id, self.revision);
        decrypt_bytes(key, &self.payload_nonce, &self.ciphertext, aad.as_bytes())
    }

    fn validate_format(&self) -> Result<(), AppError> {
        if self.format != VaultResource::Format.as_str() || self.vault_id.trim().is_empty() {
            return Err(AppError::new(
                ErrorCode::InvalidBackup,
                "保险库格式无效或缺少 Vault ID",
            ));
        }
        Ok(())
    }
}

/// 校验用户备份密码是否满足当前 vault 格式的最低强度要求。
pub fn validate_backup_password(password: &str) -> Result<(), AppError> {
    if password.chars().count() < VaultPolicy::MinimumPasswordCharacters.value() as usize {
        return Err(AppError::new(
            ErrorCode::CryptoEncryptFailed,
            format!(
                "备份密码至少需要 {} 个字符",
                VaultPolicy::MinimumPasswordCharacters.value()
            ),
        ));
    }
    Ok(())
}

fn generate_key() -> VaultKey {
    let mut key = [0_u8; VAULT_KEY_BYTES];
    use aes_gcm::aead::rand_core::RngCore;
    OsRng.fill_bytes(&mut key);
    key
}

/// 使用新的备份密码重新包装既有 Vault Key，不改变载荷加密密钥。
pub fn wrap_vault_key(
    key: &VaultKey,
    backup_password: &str,
    vault_id: &str,
) -> Result<VaultKeyEnvelope, AppError> {
    let salt_len = VaultPolicy::SaltBytes.value() as usize;
    let mut salt = vec![0_u8; salt_len];
    use aes_gcm::aead::rand_core::RngCore;
    OsRng.fill_bytes(&mut salt);
    let kdf = VaultKdfParameters {
        salt: STANDARD.encode(&salt),
        memory_kib: VaultPolicy::ArgonMemoryKib.value(),
        iterations: VaultPolicy::ArgonIterations.value(),
        parallelism: VaultPolicy::ArgonParallelism.value(),
    };
    let wrapping_key = derive_key(backup_password, &kdf)?;
    let (nonce, ciphertext) =
        encrypt_bytes(&wrapping_key, key, key_envelope_aad(vault_id).as_bytes())?;
    Ok(VaultKeyEnvelope {
        kdf,
        nonce,
        ciphertext,
    })
}

fn unwrap_key(
    envelope: &VaultKeyEnvelope,
    backup_password: &str,
    vault_id: &str,
) -> Result<VaultKey, AppError> {
    let wrapping_key = derive_key(backup_password, &envelope.kdf)?;
    let decoded = decrypt_bytes(
        &wrapping_key,
        &envelope.nonce,
        &envelope.ciphertext,
        key_envelope_aad(vault_id).as_bytes(),
    )
    .map_err(|_| AppError::new(ErrorCode::CryptoDecryptFailed, "备份密码错误或保险库已损坏"))?;
    decoded
        .try_into()
        .map_err(|_| AppError::new(ErrorCode::InvalidBackup, "保险库密钥长度无效"))
}

fn derive_key(password: &str, kdf: &VaultKdfParameters) -> Result<VaultKey, AppError> {
    let salt = STANDARD.decode(&kdf.salt).map_err(|error| {
        AppError::new(
            ErrorCode::InvalidBackup,
            format!("无效的保险库 salt: {error}"),
        )
    })?;
    if salt.len() != VaultPolicy::SaltBytes.value() as usize
        || kdf.memory_kib != VaultPolicy::ArgonMemoryKib.value()
        || kdf.iterations != VaultPolicy::ArgonIterations.value()
        || kdf.parallelism != VaultPolicy::ArgonParallelism.value()
    {
        return Err(AppError::new(
            ErrorCode::InvalidBackup,
            "保险库 KDF 参数不受当前 vault.v1 格式支持",
        ));
    }
    let params = Params::new(
        kdf.memory_kib,
        kdf.iterations,
        kdf.parallelism,
        Some(VAULT_KEY_BYTES),
    )
    .map_err(|error| AppError::new(ErrorCode::InvalidBackup, error.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0_u8; VAULT_KEY_BYTES];
    argon2
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|error| AppError::new(ErrorCode::CryptoDecryptFailed, error.to_string()))?;
    Ok(key)
}

fn encrypt_bytes(
    key: &VaultKey,
    plaintext: &[u8],
    aad: &[u8],
) -> Result<(String, String), AppError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|error| AppError::new(ErrorCode::CryptoEncryptFailed, error.to_string()))?;
    let mut rng = OsRng;
    let nonce = Aes256Gcm::generate_nonce(&mut rng);
    let ciphertext = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plaintext,
                aad,
            },
        )
        .map_err(|error| AppError::new(ErrorCode::CryptoEncryptFailed, error.to_string()))?;
    Ok((STANDARD.encode(nonce), STANDARD.encode(ciphertext)))
}

fn decrypt_bytes(
    key: &VaultKey,
    nonce: &str,
    ciphertext: &str,
    aad: &[u8],
) -> Result<Vec<u8>, AppError> {
    let nonce = STANDARD.decode(nonce).map_err(|error| {
        AppError::new(ErrorCode::InvalidBackup, format!("无效的 nonce: {error}"))
    })?;
    if nonce.len() != VaultPolicy::NonceBytes.value() as usize {
        return Err(AppError::new(ErrorCode::InvalidBackup, "nonce 长度无效"));
    }
    let ciphertext = STANDARD
        .decode(ciphertext)
        .map_err(|error| AppError::new(ErrorCode::InvalidBackup, format!("无效的密文: {error}")))?;
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|error| AppError::new(ErrorCode::CryptoDecryptFailed, error.to_string()))?;
    cipher
        .decrypt(
            aes_gcm::Nonce::from_slice(&nonce),
            Payload {
                msg: &ciphertext,
                aad,
            },
        )
        .map_err(|_| AppError::new(ErrorCode::CryptoDecryptFailed, "保险库解密失败"))
}

fn key_envelope_aad(vault_id: &str) -> String {
    format!("{}:{vault_id}:key", VaultResource::Format.as_str())
}

fn payload_aad(vault_id: &str, revision: u64) -> String {
    format!(
        "{}:{vault_id}:revision:{revision}",
        VaultResource::Format.as_str()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_vault_round_trips_across_keys() {
        let (document, key) = PortableVaultDocument::create(
            br#"{"password":"secret"}"#,
            "correct horse battery staple",
            "vault-id".to_string(),
            1,
        )
        .expect("create vault");
        let serialized = serde_json::to_string(&document).expect("serialize vault");
        assert!(!serialized.contains("secret"));

        let parsed: PortableVaultDocument = serde_json::from_str(&serialized).expect("parse vault");
        let (plaintext, unlocked_key) = parsed
            .decrypt_with_password("correct horse battery staple")
            .expect("unlock vault");
        assert_eq!(plaintext, br#"{"password":"secret"}"#);
        assert_eq!(unlocked_key, key);
    }

    #[test]
    fn wrong_backup_password_is_actionable() {
        let (document, _) = PortableVaultDocument::create(
            b"payload",
            "correct-password",
            "vault-id".to_string(),
            1,
        )
        .expect("create vault");
        let error = document
            .decrypt_with_password("wrong-password")
            .expect_err("wrong password must fail");
        assert_eq!(error.code, ErrorCode::CryptoDecryptFailed);
        assert!(error.message.contains("备份密码"));
    }

    #[test]
    fn cached_key_can_encrypt_the_next_revision() {
        let (first, key) =
            PortableVaultDocument::create(b"first", "correct-password", "vault-id".to_string(), 1)
                .expect("create vault");
        let second = PortableVaultDocument::encrypt(
            b"second",
            key,
            first.vault_id.clone(),
            2,
            first.key_envelope.clone(),
        )
        .expect("encrypt revision");
        assert_eq!(second.decrypt_with_key(&key).expect("decrypt"), b"second");
    }

    #[test]
    fn existing_vault_key_can_be_rewrapped_with_a_new_password() {
        let (document, key) =
            PortableVaultDocument::create(b"payload", "old-password", "vault-id".to_string(), 1)
                .expect("create vault");
        let envelope =
            wrap_vault_key(&key, "new-password", &document.vault_id).expect("rewrap key");

        assert!(unlock_vault_key(&envelope, "old-password", &document.vault_id).is_err());
        assert_eq!(
            unlock_vault_key(&envelope, "new-password", &document.vault_id)
                .expect("unlock rewrapped key"),
            key,
        );
    }
}
