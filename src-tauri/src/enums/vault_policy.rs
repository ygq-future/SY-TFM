//! 跨设备加密保险库的稳定策略参数。

/// 保险库密钥派生与格式限制。
pub(crate) enum VaultPolicy {
    /// Argon2id 内存成本（KiB）。
    ArgonMemoryKib,
    /// Argon2id 迭代次数。
    ArgonIterations,
    /// Argon2id 并行度。
    ArgonParallelism,
    /// 随机 salt 字节数。
    SaltBytes,
    /// AES-GCM nonce 字节数。
    NonceBytes,
    /// 用户备份密码允许的最小字符数。
    MinimumPasswordCharacters,
    /// 连续配置变更后的自动同步防抖毫秒数。
    AutoSyncDebounceMilliseconds,
    /// 前端同步状态刷新周期（毫秒）。
    StatusRefreshMilliseconds,
    /// 桌面关闭前等待保险库冲刷的最长毫秒数。
    CloseFlushTimeoutMilliseconds,
    /// 单个保险库文件允许的最大字节数。
    MaximumFileBytes,
    /// 单个平台背景资源解压后的最大字节数。
    MaximumBackgroundBytes,
    /// 本地便携备份与旧版云端载荷的 schema 版本。
    PortablePayloadSchemaVersion,
    /// 按平台隔离设置的云端载荷 schema 版本。
    CloudPayloadSchemaVersion,
    /// 仍可读取的内嵌背景云端载荷 schema 版本。
    LegacyCloudPayloadSchemaVersion,
}

/// Vault Key 的固定 AES-256 字节数。
pub(crate) const VAULT_KEY_BYTES: usize = 32;

impl VaultPolicy {
    /// 返回策略对应的数值。
    pub(crate) const fn value(&self) -> u32 {
        match self {
            Self::ArgonMemoryKib => 64 * 1024,
            Self::ArgonIterations => 3,
            Self::ArgonParallelism => 1,
            Self::SaltBytes => 16,
            Self::NonceBytes => 12,
            Self::MinimumPasswordCharacters => 8,
            Self::AutoSyncDebounceMilliseconds => 1_500,
            Self::StatusRefreshMilliseconds => 30_000,
            Self::CloseFlushTimeoutMilliseconds => 10_000,
            Self::MaximumFileBytes => 32 * 1024 * 1024,
            Self::MaximumBackgroundBytes => 20 * 1024 * 1024,
            Self::PortablePayloadSchemaVersion => 1,
            Self::CloudPayloadSchemaVersion => 3,
            Self::LegacyCloudPayloadSchemaVersion => 2,
        }
    }
}
