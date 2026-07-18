//! 传输任务的稳定策略参数。

/// 传输调度使用的时间与缓冲策略。
pub(crate) enum TransferPolicy {
    /// 连续无进度后终止任务的秒数。
    IdleTimeoutSeconds,
    /// 向 WebView 推送进度的最小间隔毫秒数。
    ProgressIntervalMilliseconds,
    /// 单次流式读写缓冲区字节数。
    #[cfg(any(feature = "sftp-adapter", feature = "webdav-adapter"))]
    TransferBufferBytes,
    /// 建立网络连接的超时秒数。
    ConnectTimeoutSeconds,
    /// 单次网络读取的超时秒数。
    ReadTimeoutSeconds,
}

impl TransferPolicy {
    /// 返回策略的数值。
    pub(crate) const fn value(&self) -> u64 {
        match self {
            Self::IdleTimeoutSeconds => 45,
            Self::ProgressIntervalMilliseconds => 100,
            #[cfg(any(feature = "sftp-adapter", feature = "webdav-adapter"))]
            Self::TransferBufferBytes => 256 * 1024,
            Self::ConnectTimeoutSeconds => 15,
            Self::ReadTimeoutSeconds => 45,
        }
    }
}
