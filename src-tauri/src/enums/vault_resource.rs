//! 跨设备保险库使用的稳定资源名称。

/// 保险库远端路径、格式标识与本机凭据条目。
pub(crate) enum VaultResource {
    /// WebDAV 中的应用目录。
    CloudDirectory,
    /// WebDAV 中的保险库文件名。
    CloudFile,
    /// Windows 平台背景资源名称前缀。
    BackgroundWindowsPrefix,
    /// macOS 平台背景资源名称前缀。
    BackgroundMacosPrefix,
    /// Linux 平台背景资源名称前缀。
    BackgroundLinuxPrefix,
    /// iOS 平台背景资源名称前缀。
    BackgroundIosPrefix,
    /// Android 平台背景资源名称前缀。
    BackgroundAndroidPrefix,
    /// 背景资源压缩文件扩展名。
    BackgroundArchiveExtension,
    /// 保险库格式标识。
    Format,
    /// 加密载荷在加密前使用的压缩编码。
    PayloadEncodingGzip,
    /// 系统凭据库中的保险库密钥账户。
    KeyringAccount,
    /// 系统凭据库中的设备主密钥账户。
    MasterKeyAccount,
    /// 系统凭据库中的应用服务名称。
    #[cfg(not(target_os = "android"))]
    KeyringService,
    /// 本机临时目录名称。
    TemporaryDirectory,
}

impl VaultResource {
    /// 返回稳定字符串。
    pub(crate) const fn as_str(&self) -> &'static str {
        match self {
            Self::CloudDirectory => "SY-TFM",
            Self::CloudFile => "sy-tfm-vault.sytfm",
            Self::BackgroundWindowsPrefix => "background-windows-",
            Self::BackgroundMacosPrefix => "background-macos-",
            Self::BackgroundLinuxPrefix => "background-linux-",
            Self::BackgroundIosPrefix => "background-ios-",
            Self::BackgroundAndroidPrefix => "background-android-",
            Self::BackgroundArchiveExtension => ".gz",
            Self::Format => "vault.v1",
            Self::PayloadEncodingGzip => "gzip",
            Self::KeyringAccount => "portable-vault-key",
            Self::MasterKeyAccount => "master-key",
            #[cfg(not(target_os = "android"))]
            Self::KeyringService => "com.sy.tfm",
            Self::TemporaryDirectory => "vault-sync",
        }
    }
}
