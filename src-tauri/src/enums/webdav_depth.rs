//! WebDAV `PROPFIND` 请求深度。

/// RFC 4918 定义的有限 `Depth` 请求值。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WebDavDepth {
    /// 仅请求资源自身。
    Resource,
    /// 请求资源自身及其直属成员。
    Children,
}

impl WebDavDepth {
    /// 返回 HTTP `Depth` 头使用的稳定值。
    pub(crate) const fn as_header_value(&self) -> &'static str {
        match self {
            Self::Resource => "0",
            Self::Children => "1",
        }
    }
}
