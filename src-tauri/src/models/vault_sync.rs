use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::enums::VaultSyncPhase;

/// 备份密码派生密钥所需的公开参数。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct VaultKdfParameters {
    /// Base64 编码的随机 salt。
    pub salt: String,
    /// Argon2id 内存成本（KiB）。
    pub memory_kib: u32,
    /// Argon2id 迭代次数。
    pub iterations: u32,
    /// Argon2id 并行度。
    pub parallelism: u32,
}

/// 由备份密码保护的跨设备 Vault Key 信封。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct VaultKeyEnvelope {
    /// 密钥派生参数。
    pub kdf: VaultKdfParameters,
    /// Base64 编码的 AES-GCM nonce。
    pub nonce: String,
    /// Base64 编码的已包装 Vault Key。
    pub ciphertext: String,
}

/// 持久化的 WebDAV 保险库同步配置。
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct VaultSyncSettings {
    /// 是否启用自动同步。
    #[serde(default)]
    pub enabled: bool,
    /// 用户输入的 WebDAV 服务 URL。
    #[serde(default)]
    pub webdav_url: String,
    /// WebDAV 用户名。
    #[serde(default)]
    pub username: String,
    /// 由当前设备主密钥加密的 WebDAV 密码。
    #[serde(default)]
    pub password: String,
    /// 由当前设备主密钥加密、供 WebDAV 与本地便携备份共用的备份密码。
    #[serde(default)]
    pub backup_password: String,
    /// Vault 的稳定 ID。
    #[serde(default)]
    pub vault_id: String,
    /// 备份密码保护的 Vault Key 信封。
    #[serde(default)]
    pub key_envelope: Option<VaultKeyEnvelope>,
    /// 最近一次成功同步的 revision。
    #[serde(default)]
    pub last_synced_revision: u64,
    /// 最近一次成功同步时间（RFC 3339）。
    #[serde(default)]
    pub last_synced_at: Option<String>,
    /// 上次同步时“共享主机 + 当前平台分区”的 SHA-256 内容指纹。
    #[serde(default)]
    pub last_synced_scope_hash: String,
    /// 上次同步时共享主机集合的独立 SHA-256 内容指纹。
    #[serde(default)]
    pub last_synced_hosts_hash: String,
    /// 由本机设备密钥加密的上次已同步主机快照，用于逐主机三方合并。
    #[serde(default)]
    pub last_synced_hosts_snapshot: String,
    /// 上次同步时当前平台设置分区的独立 SHA-256 内容指纹。
    #[serde(default)]
    pub last_synced_platform_hash: String,
    /// 是否存在尚未确认写入云端的本地主机变化。
    #[serde(default)]
    pub sync_pending: bool,
    /// 本地主机共享数据变化的单调递增代际。
    #[serde(default)]
    pub sync_change_generation: u64,
}

/// 前端提交的 WebDAV 恢复引导凭据。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct VaultWebDavCredentials {
    /// WebDAV 服务 URL，例如 `https://example.com/dav`。
    pub webdav_url: String,
    /// WebDAV 用户名。
    pub username: String,
    /// WebDAV 密码或应用密码。
    pub password: String,
}

/// 设置页展示的保险库同步状态。
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct VaultSyncStatus {
    /// 是否已保存完整 WebDAV 配置。
    pub configured: bool,
    /// 是否已启用同步。
    pub enabled: bool,
    /// 当前同步生命周期阶段。
    pub phase: VaultSyncPhase,
    /// 是否已经创建或恢复过云端保险库。
    pub vault_initialized: bool,
    /// 是否已经保存 WebDAV 密码。
    pub password_saved: bool,
    /// 是否已经在本机加密保存共用备份密码。
    pub backup_password_saved: bool,
    /// 当前 WebDAV URL。
    pub webdav_url: String,
    /// 当前 WebDAV 用户名。
    pub username: String,
    /// 固定云端目录和文件路径。
    pub remote_path: String,
    /// 最近成功同步的 revision。
    pub revision: u64,
    /// 最近成功同步时间。
    pub last_synced_at: Option<String>,
    /// 当前设备是否缓存了 Vault Key。
    pub unlocked_on_device: bool,
    /// 状态栏刷新同步状态的后端策略周期（毫秒）。
    pub refresh_interval_ms: u32,
}
