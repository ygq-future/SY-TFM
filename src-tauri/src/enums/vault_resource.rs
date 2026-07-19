//! 跨设备保险库使用的稳定资源名称。

/// 保险库远端路径、格式标识与本机凭据条目。
pub(crate) enum VaultResource {
    /// WebDAV 中的应用目录。
    CloudDirectory,
    /// WebDAV 中的保险库文件名。
    CloudFile,
    /// 保险库格式标识。
    Format,
    /// 系统凭据库中的保险库密钥账户。
    KeyringAccount,
    /// 本机临时目录名称。
    TemporaryDirectory,
}

impl VaultResource {
    /// 返回稳定字符串。
    pub(crate) const fn as_str(&self) -> &'static str {
        match self {
            Self::CloudDirectory => "SY-TFM",
            Self::CloudFile => "sy-tfm-vault.sytfm",
            Self::Format => "vault.v1",
            Self::KeyringAccount => "portable-vault-key",
            Self::TemporaryDirectory => "vault-sync",
        }
    }
}
