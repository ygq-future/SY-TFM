//! 编辑功能内部策略常量。

/// 编辑功能的限制与节流策略。
pub(crate) enum EditPolicy {
    /// 本地文件连续变更后的同步防抖时间。
    WatchDebounceMilliseconds,
    /// 在线编辑允许读取的最大字节数。
    MaxOnlineFileBytes,
    /// Remote Edit 临时文件名中展示的会话 UUID 十六进制字符数。
    RemoteEditSuffixHexCharacters,
    /// Windows 单个本地文件名允许的最大 UTF-16 单元数。
    MaxLocalFileNameUtf16Units,
}

impl EditPolicy {
    /// 返回策略对应的数值。
    pub(crate) const fn value(&self) -> u64 {
        match self {
            Self::WatchDebounceMilliseconds => 500,
            Self::MaxOnlineFileBytes => 5 * 1024 * 1024,
            Self::RemoteEditSuffixHexCharacters => 8,
            Self::MaxLocalFileNameUtf16Units => 255,
        }
    }
}
