//! 加密模块：SecretProtector（AES-256-GCM）+ key_storage。

pub mod key_storage;
pub mod portable_vault;
pub mod secret_protector;

pub use portable_vault::{unlock_vault_key, PortableVaultDocument, VaultKey};
pub use secret_protector::SecretProtector;
