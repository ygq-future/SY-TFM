//! 加密模块：SecretProtector（AES-256-GCM）+ key_storage。

pub mod key_storage;
pub mod secret_protector;

pub use secret_protector::SecretProtector;
