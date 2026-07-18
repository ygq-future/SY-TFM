//! 编辑功能内部策略常量。

/// 编辑功能的限制与节流策略。
pub(crate) enum EditPolicy {
    /// 本地文件连续变更后的同步防抖时间。
    WatchDebounceMilliseconds,
    /// 在线编辑允许读取的最大字节数。
    MaxOnlineFileBytes,
}

impl EditPolicy {
    /// 返回策略对应的数值。
    pub(crate) const fn value(&self) -> u64 {
        match self {
            Self::WatchDebounceMilliseconds => 500,
            Self::MaxOnlineFileBytes => 5 * 1024 * 1024,
        }
    }
}
