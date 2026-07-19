//! 应用管理的本地目录名称。

/// 应用在系统目录下创建的专用子目录。
pub(crate) enum AppDirectory {
    /// 默认下载根目录。
    DownloadRoot,
    /// 外部编辑器使用的临时文件根目录。
    RemoteEditRoot,
    /// Remote Edit 会话目录中的跨进程租约文件。
    RemoteEditLease,
    /// 从便携保险库恢复的背景图片目录。
    VaultBackgroundRoot,
}

impl AppDirectory {
    /// 返回稳定的目录名称。
    pub(crate) const fn as_str(&self) -> &'static str {
        match self {
            Self::DownloadRoot => "SY-TFM",
            Self::RemoteEditRoot => "SY-TFM",
            Self::RemoteEditLease => ".lock",
            Self::VaultBackgroundRoot => "backgrounds",
        }
    }
}
