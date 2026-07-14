//! WebDAV adapter。
//!
//! 启用 `webdav-adapter` feature 时：基于 reqwest + quick-xml 的完整实现。
//! 未启用时：返回 unsupported 的 stub。

// ============================================================
// 完整实现（feature = "webdav-adapter"）
// ============================================================
#[cfg(feature = "webdav-adapter")]
mod impl_ {
    use std::time::Duration;

    use async_trait::async_trait;
    use reqwest::Method;
    use reqwest::Client;

    use crate::enums::{AdapterCapability, Protocol};
    use crate::error::AppError;
    use crate::models::{RemoteFile, RemoteHost};
    use crate::transport::{FileTransport, ProgressEvent, ProgressTx};

    /// PROPFIND 请求体 XML。
    const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>"#;

    /// WebDAV adapter。
    pub struct WebDavAdapter {
        client: Option<Client>,
        base_url: String,
        current_dir: String,
    }

    impl WebDavAdapter {
        pub fn new() -> Self {
            Self {
                client: None,
                base_url: String::new(),
                current_dir: String::from("/"),
            }
        }

        /// 构建 WebDAV URL。
        fn url(&self, path: &str) -> String {
            let base = self.base_url.trim_end_matches('/');
            let p = path.trim_start_matches('/');
            if p.is_empty() {
                base.to_string()
            } else {
                format!("{base}/{p}")
            }
        }

        /// 发送自定义 HTTP method。
        async fn request(
            &self,
            method: &str,
            url: &str,
            body: Option<&str>,
        ) -> Result<reqwest::Response, AppError> {
            let client = self
                .client
                .as_ref()
                .ok_or_else(AppError::not_connected)?;
            let m = Method::from_bytes(method.as_bytes())
                .map_err(|e| AppError::protocol_error(e.to_string()))?;
            let mut req = client.request(m, url);
            if let Some(b) = body {
                req = req.header("Content-Type", "application/xml").body(b.to_string());
            }
            let resp = req
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("HTTP 请求失败: {e}")))?;
            if !resp.status().is_success() && resp.status().as_u16() != 207 {
                return Err(AppError::protocol_error(format!(
                    "HTTP {}",
                    resp.status()
                )));
            }
            Ok(resp)
        }

        /// 解析 PROPFIND multistatus XML 响应。
        fn parse_multistatus(&self, xml: &str, list_path: &str) -> Result<Vec<RemoteFile>, AppError> {
            let mut files = Vec::new();
            let mut reader = quick_xml::Reader::from_str(xml);
            reader.config_mut().trim_text(true);

            let mut buf = Vec::new();
            let mut current: Option<RemoteFile> = None;
            let mut in_href = false;
            let mut in_displayname = false;
            let mut in_getcontentlength = false;
            let mut in_getlastmodified = false;
            let mut in_collection = false;
            let mut current_text = String::new();

            loop {
                use quick_xml::events::Event;
                match reader.read_event_into(&mut buf) {
                    Ok(Event::Start(e)) => {
                        let name = String::from_utf8_lossy(e.name().as_ref());
                        match name.as_ref() {
                            "response" => current = Some(RemoteFile {
                                name: String::new(),
                                full_path: String::new(),
                                size: 0,
                                is_directory: false,
                                last_modified: String::new(),
                                owner: None,
                                permissions: None,
                            }),
                            "href" => in_href = true,
                            "displayname" => in_displayname = true,
                            "getcontentlength" => in_getcontentlength = true,
                            "getlastmodified" => in_getlastmodified = true,
                            "collection" => in_collection = true,
                            _ => {}
                        }
                        current_text.clear();
                    }
                    Ok(Event::Text(e)) => {
                        current_text = e.unescape().map(|s| s.to_string()).unwrap_or_default();
                    }
                    Ok(Event::End(e)) => {
                        let name = String::from_utf8_lossy(e.name().as_ref());
                        match name.as_ref() {
                            "href" => {
                                if let Some(ref mut f) = current {
                                    f.full_path = current_text.clone();
                                }
                                in_href = false;
                            }
                            "displayname" => {
                                if let Some(ref mut f) = current {
                                    f.name = current_text.clone();
                                }
                                in_displayname = false;
                            }
                            "getcontentlength" => {
                                if let Some(ref mut f) = current {
                                    f.size = current_text.parse().unwrap_or(0);
                                }
                                in_getcontentlength = false;
                            }
                            "getlastmodified" => {
                                if let Some(ref mut f) = current {
                                    f.last_modified = current_text.clone();
                                }
                                in_getlastmodified = false;
                            }
                            "collection" => {
                                if let Some(ref mut f) = current {
                                    f.is_directory = true;
                                }
                                in_collection = false;
                            }
                            "response" => {
                                if let Some(f) = current.take() {
                                    // 跳过目录本身（href 等于 list_path）
                                    let normalized = f.full_path.trim_end_matches('/');
                                    let list_norm = list_path.trim_end_matches('/');
                                    if !normalized.is_empty() && normalized != list_norm {
                                        let mut file = f;
                                        if file.name.is_empty() {
                                            file.name = file
                                                .full_path
                                                .rsplit('/')
                                                .next()
                                                .unwrap_or("")
                                                .to_string();
                                        }
                                        // URL 解码文件名
                                        file.name = urlencoding_decode(&file.name);
                                        file.full_path = urlencoding_decode(&file.full_path);
                                        files.push(file);
                                    }
                                }
                            }
                            _ => {}
                        }
                        current_text.clear();
                    }
                    Ok(Event::Eof) => break,
                    Err(e) => {
                        return Err(AppError::protocol_error(format!(
                            "XML 解析失败: {e}"
                        )))
                    }
                    _ => {}
                }
            }
            Ok(files)
        }
    }

    impl Default for WebDavAdapter {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait]
    impl FileTransport for WebDavAdapter {
        fn protocol(&self) -> Protocol {
            Protocol::WebDav
        }

        fn capabilities(&self) -> AdapterCapability {
            // WebDAV 不支持 owner/permissions
            AdapterCapability::RANGE_TRANSFER
        }

        async fn connect(
            &mut self,
            host: &RemoteHost,
            password: Option<&str>,
        ) -> Result<(), AppError> {
            let scheme = if host.https { "https" } else { "http" };
            let port = host.effective_port();
            let base_path = host.base_path.as_deref().unwrap_or("");
            self.base_url = format!("{scheme}://{}:{port}{base_path}", host.host);

            let mut builder = Client::builder()
                .timeout(Duration::from_secs(30))
                .danger_accept_invalid_certs(true); // Phase 1 简化

            // 基本认证
            if !host.username.is_empty() {
                let password = password.unwrap_or("");
                builder = builder.default_auth(reqwest::Auth::basic(
                    &host.username,
                    password,
                ));
            }

            self.client = Some(
                builder
                    .build()
                    .map_err(|e| AppError::connection_failed(format!("HTTP 客户端初始化失败: {e}")))?,
            );

            // 验证连接：PROPFIND 根目录
            let url = self.url("/");
            self.request("PROPFIND", &url, Some(PROPFIND_BODY))
                .await
                .map_err(|e| AppError::connection_failed(format!("WebDAV 连接验证失败: {e}")))?;

            self.current_dir = "/".to_string();
            Ok(())
        }

        async fn disconnect(&mut self) -> Result<(), AppError> {
            self.client = None;
            Ok(())
        }

        async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError> {
            let url = self.url(path);
            let resp = self.request("PROPFIND", &url, Some(PROPFIND_BODY)).await?;
            let xml = resp
                .text()
                .await
                .map_err(|e| AppError::protocol_error(format!("读取响应失败: {e}")))?;
            self.parse_multistatus(&xml, path)
        }

        async fn download_file(
            &self,
            remote_path: &str,
            local_path: &str,
            progress: ProgressTx,
        ) -> Result<(), AppError> {
            let client = self
                .client
                .as_ref()
                .ok_or_else(AppError::not_connected)?;
            let url = self.url(remote_path);
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("下载请求失败: {e}")))?;

            if !resp.status().is_success() {
                return Err(AppError::protocol_error(format!("HTTP {}", resp.status())));
            }

            let total = resp.content_length().unwrap_or(0);
            let mut local = tokio::fs::File::create(local_path).await?;
            let mut stream = resp.bytes_stream();
            use futures_util::StreamExt;
            let mut transferred: u64 = 0;
            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|e| {
                    AppError::protocol_error(format!("读取数据块失败: {e}"))
                })?;
                tokio::io::AsyncWriteExt::write_all(&mut local, &chunk).await?;
                transferred += chunk.len() as u64;
                let _ = progress
                    .send(ProgressEvent::Progress {
                        transferred,
                        total,
                        current_file: remote_path.to_string(),
                    })
                    .await;
            }
            let _ = progress.send(ProgressEvent::Done).await;
            Ok(())
        }

        async fn upload_file(
            &self,
            local_path: &str,
            remote_path: &str,
            progress: ProgressTx,
        ) -> Result<(), AppError> {
            let client = self
                .client
                .as_ref()
                .ok_or_else(AppError::not_connected)?;
            let url = self.url(remote_path);
            let data = tokio::fs::read(local_path).await?;
            let total = data.len() as u64;

            let resp = client
                .put(&url)
                .body(data)
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("上传请求失败: {e}")))?;

            if !resp.status().is_success() {
                return Err(AppError::protocol_error(format!("HTTP {}", resp.status())));
            }

            let _ = progress
                .send(ProgressEvent::Progress {
                    transferred: total,
                    total,
                    current_file: remote_path.to_string(),
                })
                .await;
            let _ = progress.send(ProgressEvent::Done).await;
            Ok(())
        }

        async fn delete_file(&self, path: &str) -> Result<(), AppError> {
            let url = self.url(path);
            self.request("DELETE", &url, None).await?;
            Ok(())
        }

        async fn delete_directory(&self, path: &str) -> Result<(), AppError> {
            // WebDAV DELETE 同时适用于文件和目录
            self.delete_file(path).await
        }

        async fn create_directory(&self, path: &str) -> Result<(), AppError> {
            let url = self.url(path);
            self.request("MKCOL", &url, None).await?;
            Ok(())
        }

        async fn move_file(&self, from: &str, to: &str) -> Result<(), AppError> {
            let from_url = self.url(from);
            let to_url = self.url(to);
            let client = self
                .client
                .as_ref()
                .ok_or_else(AppError::not_connected)?;
            let m = Method::from_bytes(b"MOVE")
                .map_err(|e| AppError::protocol_error(e.to_string()))?;
            let resp = client
                .request(m, &from_url)
                .header("Destination", &to_url)
                .header("Overwrite", "T")
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("MOVE 请求失败: {e}")))?;
            if !resp.status().is_success() {
                return Err(AppError::protocol_error(format!("HTTP {}", resp.status())));
            }
            Ok(())
        }

        async fn get_working_dir(&self) -> Result<String, AppError> {
            Ok(self.current_dir.clone())
        }

        async fn change_dir(&mut self, path: &str) -> Result<(), AppError> {
            // 验证目录存在（PROPFIND）
            let url = self.url(path);
            self.request("PROPFIND", &url, Some(PROPFIND_BODY)).await?;
            self.current_dir = path.to_string();
            Ok(())
        }

        async fn is_connected(&self) -> bool {
            self.client.is_some()
        }
    }

    /// URL 解码（简化版）。
    fn urlencoding_decode(s: &str) -> String {
        let mut result = String::new();
        let bytes = s.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'%' && i + 2 < bytes.len() {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("00");
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    result.push(byte as char);
                    i += 3;
                    continue;
                }
            }
            result.push(bytes[i] as char);
            i += 1;
        }
        result
    }
}

#[cfg(feature = "webdav-adapter")]
pub use impl_::WebDavAdapter;

// ============================================================
// Stub 实现（未启用 feature）
// ============================================================
#[cfg(not(feature = "webdav-adapter"))]
mod stub {
    use async_trait::async_trait;

    use crate::enums::{AdapterCapability, Protocol};
    use crate::error::AppError;
    use crate::models::{RemoteFile, RemoteHost};
    use crate::transport::{FileTransport, ProgressTx};

    pub struct WebDavAdapter;

    impl WebDavAdapter {
        pub fn new() -> Self {
            Self
        }
    }

    impl Default for WebDavAdapter {
        fn default() -> Self {
            Self::new()
        }
    }

    fn unsupported() -> AppError {
        AppError::unsupported("WebDAV adapter 未启用（需 webdav-adapter feature）")
    }

    #[async_trait]
    impl FileTransport for WebDavAdapter {
        fn protocol(&self) -> Protocol {
            Protocol::WebDav
        }

        fn capabilities(&self) -> AdapterCapability {
            AdapterCapability::RANGE_TRANSFER
        }

        async fn connect(
            &mut self,
            _host: &RemoteHost,
            _password: Option<&str>,
        ) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn disconnect(&mut self) -> Result<(), AppError> {
            Ok(())
        }

        async fn list_directory(&self, _path: &str) -> Result<Vec<RemoteFile>, AppError> {
            Err(unsupported())
        }

        async fn download_file(
            &self,
            _remote_path: &str,
            _local_path: &str,
            _progress: ProgressTx,
        ) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn upload_file(
            &self,
            _local_path: &str,
            _remote_path: &str,
            _progress: ProgressTx,
        ) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn delete_file(&self, _path: &str) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn delete_directory(&self, _path: &str) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn create_directory(&self, _path: &str) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn move_file(&self, _from: &str, _to: &str) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn get_working_dir(&self) -> Result<String, AppError> {
            Err(unsupported())
        }

        async fn change_dir(&mut self, _path: &str) -> Result<(), AppError> {
            Err(unsupported())
        }

        async fn is_connected(&self) -> bool {
            false
        }
    }
}

#[cfg(not(feature = "webdav-adapter"))]
pub use stub::WebDavAdapter;
