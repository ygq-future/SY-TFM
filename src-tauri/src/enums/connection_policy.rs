//! 连接保活与健康探测策略。

/// 连接生命周期使用的稳定策略参数。
pub(crate) enum ConnectionPolicy {
    /// 后端检查已登记会话真实状态的间隔秒数。
    HealthCheckIntervalSeconds,
    /// 单次主动网络健康探测的超时秒数。
    #[cfg(feature = "webdav-adapter")]
    HealthProbeTimeoutSeconds,
    /// SSH keepalive 发送间隔秒数。
    #[cfg(feature = "sftp-adapter")]
    SshKeepaliveIntervalSeconds,
    /// SSH keepalive 允许连续无响应的次数。
    #[cfg(feature = "sftp-adapter")]
    SshKeepaliveMaxMisses,
}

impl ConnectionPolicy {
    /// 返回策略的数值。
    pub(crate) const fn value(&self) -> u64 {
        match self {
            Self::HealthCheckIntervalSeconds => 5,
            #[cfg(feature = "webdav-adapter")]
            Self::HealthProbeTimeoutSeconds => 10,
            #[cfg(feature = "sftp-adapter")]
            Self::SshKeepaliveIntervalSeconds => 15,
            #[cfg(feature = "sftp-adapter")]
            Self::SshKeepaliveMaxMisses => 3,
        }
    }
}
