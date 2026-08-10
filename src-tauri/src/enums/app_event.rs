//! Tauri 事件名称。

/// 应用内部使用的 Tauri 事件名称。
pub(crate) enum AppEvent {
    /// 连接状态变化。
    ConnectionStatus,
    /// 下载进度。
    DownloadProgress,
    /// 下载完成。
    DownloadDone,
    /// 目录下载中的文件计数进度。
    DownloadBatchProgress,
    /// 上传进度。
    UploadProgress,
    /// 上传完成。
    UploadDone,
    /// 外部编辑器文件已同步。
    EditorSynced,
    /// 外部编辑器同步失败。
    EditorError,
    /// 外部编辑会话因连接断开而失效。
    EditorSessionInvalid,
    /// 保险库同步状态变化。
    VaultStatus,
}

impl AppEvent {
    /// 返回稳定的 `namespace:action` 事件名。
    pub(crate) const fn as_str(&self) -> &'static str {
        match self {
            Self::ConnectionStatus => "connection:status",
            Self::DownloadProgress => "download:progress",
            Self::DownloadDone => "download:done",
            Self::DownloadBatchProgress => "download:batch-progress",
            Self::UploadProgress => "upload:progress",
            Self::UploadDone => "upload:done",
            Self::EditorSynced => "editor:synced",
            Self::EditorError => "editor:error",
            Self::EditorSessionInvalid => "editor:session-invalid",
            Self::VaultStatus => "vault:status",
        }
    }
}
