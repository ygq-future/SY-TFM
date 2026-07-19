//! 应用管理的本地文件名称。

/// 应用在可执行文件目录中识别的稳定文件名。
pub(crate) enum AppFile {
    /// 标记当前副本应使用可执行文件旁的数据目录。
    PortableModeMarker,
}

impl AppFile {
    /// 返回稳定文件名。
    pub(crate) const fn as_str(&self) -> &'static str {
        match self {
            Self::PortableModeMarker => "SY-TFM.portable",
        }
    }
}
