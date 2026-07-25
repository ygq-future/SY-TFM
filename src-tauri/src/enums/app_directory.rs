//! 应用管理的本地目录名称。

/// 应用在系统目录下创建的专用子目录。
pub(crate) enum AppDirectory {
    /// 便携版可执行文件旁的应用数据根目录。
    PortableData,
    /// 默认下载根目录。
    DownloadRoot,
    /// Android 公共 Downloads 目录的文件系统显示路径。
    #[cfg(target_os = "android")]
    AndroidPublicDownloads,
    /// Android MediaStore 使用的 Downloads 相对目录。
    #[cfg(target_os = "android")]
    AndroidMediaDownloads,
    /// Android 下载写入共享存储前的应用私有暂存目录。
    #[cfg(target_os = "android")]
    AndroidDownloadStaging,
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
            Self::PortableData => "data",
            Self::DownloadRoot => "SY-TFM",
            #[cfg(target_os = "android")]
            Self::AndroidPublicDownloads => "/storage/emulated/0/Download",
            #[cfg(target_os = "android")]
            Self::AndroidMediaDownloads => "Download",
            #[cfg(target_os = "android")]
            Self::AndroidDownloadStaging => "download-staging",
            Self::RemoteEditRoot => "SY-TFM",
            Self::RemoteEditLease => ".lock",
            Self::VaultBackgroundRoot => "backgrounds",
        }
    }
}
