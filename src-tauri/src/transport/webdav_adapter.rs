//! WebDAV adapter。
//!
//! 启用 `webdav-adapter` feature 时：基于 reqwest + quick-xml 的完整实现。
//! 未启用时：返回 unsupported 的 stub。

// ============================================================
// 完整实现（feature = "webdav-adapter"）
// ============================================================
#[cfg(feature = "webdav-adapter")]
mod impl_ {
    use std::path::Path;
    use std::time::Duration;

    use async_trait::async_trait;
    use reqwest::{Client, Method, RequestBuilder};

    use crate::enums::connection_policy::ConnectionPolicy;
    use crate::enums::transfer_policy::TransferPolicy;
    use crate::enums::{AdapterCapability, ErrorCode, Protocol};
    use crate::error::AppError;
    use crate::local_fs::{reserve_after_final_event, AtomicDownloadFile};
    use crate::models::{RemoteFile, RemoteHost};
    use crate::transport::{FileTransport, ProgressEvent, ProgressTx};

    fn storage_write_error(error: impl std::fmt::Display) -> AppError {
        AppError::new(ErrorCode::StorageWriteFailed, error.to_string())
    }

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
        auth: Option<(String, String)>,
    }

    impl WebDavAdapter {
        pub fn new() -> Self {
            Self {
                client: None,
                base_url: String::new(),
                current_dir: String::from("/"),
                auth: None,
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

        /// 将用户输入的 WebDAV 地址、scheme、旧版端口和可选基础路径合成为服务根 URL。
        fn build_base_url(host: &RemoteHost) -> Result<String, AppError> {
            let scheme = if host.https { "https" } else { "http" };
            let raw_address = host.host.trim();
            let address = raw_address
                .split_once("://")
                .map(|(_, address)| address)
                .unwrap_or(raw_address)
                .trim_start_matches('/');
            let mut url = reqwest::Url::parse(&format!("{scheme}://{address}"))
                .map_err(|error| AppError::connection_failed(error.to_string()))?;

            if host.port != 0 && url.port().is_none() {
                url.set_port(Some(host.port)).map_err(|_| {
                    AppError::connection_failed("WebDAV URL contains an invalid port")
                })?;
            }

            let address_path = url.path().trim_matches('/');
            let base_path = host.base_path.as_deref().unwrap_or("").trim_matches('/');
            let combined_path = [address_path, base_path]
                .into_iter()
                .filter(|segment| !segment.is_empty())
                .collect::<Vec<_>>()
                .join("/");
            url.set_path(&combined_path);
            Ok(url.as_str().trim_end_matches('/').to_string())
        }

        /// 发送自定义 HTTP method。
        async fn request(
            &self,
            method: &str,
            url: &str,
            body: Option<&str>,
        ) -> Result<reqwest::Response, AppError> {
            let client = self.client.as_ref().ok_or_else(AppError::not_connected)?;
            let m = Method::from_bytes(method.as_bytes())
                .map_err(|e| AppError::protocol_error(e.to_string()))?;
            let mut req = self.authenticated(client.request(m, url));
            if let Some(b) = body {
                req = req
                    .header("Content-Type", "application/xml")
                    .body(b.to_string());
            }
            let resp = req
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("HTTP 请求失败: {e}")))?;
            if !resp.status().is_success() && resp.status().as_u16() != 207 {
                return Err(AppError::protocol_error(format!("HTTP {}", resp.status())));
            }
            Ok(resp)
        }

        /// 为请求附加当前会话的基本认证信息。
        fn authenticated(&self, request: RequestBuilder) -> RequestBuilder {
            if let Some((username, password)) = &self.auth {
                request.basic_auth(username, Some(password))
            } else {
                request
            }
        }

        /// 解析 PROPFIND multistatus XML 响应。
        fn parse_multistatus(
            &self,
            xml: &str,
            list_path: &str,
        ) -> Result<Vec<RemoteFile>, AppError> {
            let mut files = Vec::new();
            let mut reader = quick_xml::Reader::from_str(xml);
            reader.config_mut().trim_text(true);

            let mut buf = Vec::new();
            let mut current: Option<RemoteFile> = None;
            let mut current_text = String::new();

            loop {
                use quick_xml::events::Event;
                match reader.read_event_into(&mut buf) {
                    Ok(Event::Start(e)) => {
                        let local_name = e.local_name();
                        let name = String::from_utf8_lossy(local_name.as_ref());
                        if name.as_ref() == "response" {
                            current = Some(RemoteFile {
                                name: String::new(),
                                full_path: String::new(),
                                size: 0,
                                is_directory: false,
                                last_modified: String::new(),
                                owner: None,
                                permissions: None,
                            });
                        }
                        current_text.clear();
                    }
                    Ok(Event::Text(e)) => {
                        let text = e
                            .decode()
                            .map_err(|error| {
                                AppError::protocol_error(format!("XML 文本解码失败: {error}"))
                            })?
                            .into_owned();
                        current_text.push_str(&text);
                    }
                    Ok(Event::GeneralRef(e)) => {
                        if let Some(character) = e.resolve_char_ref().map_err(|error| {
                            AppError::protocol_error(format!("XML 字符引用解析失败: {error}"))
                        })? {
                            current_text.push(character);
                        } else {
                            let entity = e.decode().map_err(|error| {
                                AppError::protocol_error(format!("XML 实体解码失败: {error}"))
                            })?;
                            let resolved = quick_xml::escape::resolve_xml_entity(&entity)
                                .ok_or_else(|| {
                                    AppError::protocol_error(format!("未知 XML 实体: {entity}"))
                                })?;
                            current_text.push_str(resolved);
                        }
                    }
                    Ok(Event::Empty(e)) => {
                        let local_name = e.local_name();
                        if local_name.as_ref() == b"collection" {
                            if let Some(ref mut file) = current {
                                file.is_directory = true;
                            }
                        }
                    }
                    Ok(Event::End(e)) => {
                        let local_name = e.local_name();
                        let name = String::from_utf8_lossy(local_name.as_ref());
                        match name.as_ref() {
                            "href" => {
                                if let Some(ref mut f) = current {
                                    f.full_path = current_text.clone();
                                }
                            }
                            "displayname" => {
                                if let Some(ref mut f) = current {
                                    f.name = current_text.clone();
                                }
                            }
                            "getcontentlength" => {
                                if let Some(ref mut f) = current {
                                    f.size = current_text.parse().unwrap_or(0);
                                }
                            }
                            "getlastmodified" => {
                                if let Some(ref mut f) = current {
                                    f.last_modified = current_text.clone();
                                }
                            }
                            "collection" => {
                                if let Some(ref mut f) = current {
                                    f.is_directory = true;
                                }
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
                    Err(e) => return Err(AppError::protocol_error(format!("XML 解析失败: {e}"))),
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
            self.base_url = Self::build_base_url(host)?;

            let builder = Client::builder()
                .connect_timeout(Duration::from_secs(
                    TransferPolicy::ConnectTimeoutSeconds.value(),
                ))
                .read_timeout(Duration::from_secs(
                    TransferPolicy::ReadTimeoutSeconds.value(),
                ));

            // 存储认证信息（在每个请求上添加 basic_auth）
            if !host.username.is_empty() {
                let password = password.unwrap_or("").to_string();
                self.auth = Some((host.username.clone(), password));
            }

            self.client =
                Some(builder.build().map_err(|e| {
                    AppError::connection_failed(format!("HTTP 客户端初始化失败: {e}"))
                })?);

            // 验证连接：PROPFIND 根目录
            let url = self.url("/");
            self.request("PROPFIND", &url, Some(PROPFIND_BODY))
                .await
                .map_err(|e| AppError::connection_failed(format!("WebDAV 连接验证失败: {e}")))?;

            self.current_dir = "/".to_string();
            Ok(())
        }

        async fn disconnect(&self) -> Result<(), AppError> {
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
            let client = self.client.as_ref().ok_or_else(AppError::not_connected)?;
            let url = self.url(remote_path);
            let resp = self
                .authenticated(client.get(&url))
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("下载请求失败: {e}")))?;

            if !resp.status().is_success() {
                return Err(AppError::protocol_error(format!("HTTP {}", resp.status())));
            }

            let total = resp.content_length().unwrap_or(0);
            let mut local = AtomicDownloadFile::create(Path::new(local_path))
                .await
                .map_err(storage_write_error)?;
            let mut stream = resp.bytes_stream();
            use futures_util::StreamExt;
            use tokio::io::AsyncWriteExt;
            let mut transferred: u64 = 0;
            while let Some(chunk) = stream.next().await {
                let chunk =
                    chunk.map_err(|e| AppError::protocol_error(format!("读取数据块失败: {e}")))?;
                local
                    .file_mut()
                    .map_err(storage_write_error)?
                    .write_all(&chunk)
                    .await
                    .map_err(storage_write_error)?;
                transferred += chunk.len() as u64;
                let _ = progress.try_send(ProgressEvent::Progress {
                    transferred,
                    total,
                    current_file: remote_path.to_string(),
                });
            }
            local.prepare().await.map_err(storage_write_error)?;
            let done_permit = reserve_after_final_event(
                &progress,
                ProgressEvent::Progress {
                    transferred,
                    total,
                    current_file: remote_path.to_string(),
                },
            )
            .await;
            local.commit().map_err(storage_write_error)?;
            if let Some(permit) = done_permit {
                permit.send(ProgressEvent::Done);
            }
            Ok(())
        }

        async fn upload_file(
            &self,
            local_path: &str,
            remote_path: &str,
            progress: ProgressTx,
        ) -> Result<(), AppError> {
            let client = self.client.as_ref().ok_or_else(AppError::not_connected)?;
            let url = self.url(remote_path);
            use tokio::io::AsyncReadExt;

            let file = tokio::fs::File::open(local_path).await?;
            let total = file
                .metadata()
                .await
                .map(|metadata| metadata.len())
                .unwrap_or(0);
            let current_file = remote_path.to_string();
            let stream = futures_util::stream::try_unfold(
                (file, 0_u64, progress.clone(), current_file),
                move |(mut file, transferred, progress, current_file)| async move {
                    let mut buffer =
                        vec![0_u8; TransferPolicy::TransferBufferBytes.value() as usize];
                    let read = file.read(&mut buffer).await?;
                    if read == 0 {
                        return Ok::<_, std::io::Error>(None);
                    }
                    buffer.truncate(read);
                    let transferred = transferred + read as u64;
                    let _ = progress.try_send(ProgressEvent::Progress {
                        transferred,
                        total,
                        current_file: current_file.clone(),
                    });
                    Ok(Some((
                        (buffer),
                        (file, transferred, progress, current_file),
                    )))
                },
            );

            let resp = self
                .authenticated(client.put(&url))
                .header(reqwest::header::CONTENT_LENGTH, total)
                .body(reqwest::Body::wrap_stream(stream))
                .send()
                .await
                .map_err(|e| AppError::protocol_error(format!("上传请求失败: {e}")))?;

            if !resp.status().is_success() {
                return Err(AppError::protocol_error(format!("HTTP {}", resp.status())));
            }

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
            let client = self.client.as_ref().ok_or_else(AppError::not_connected)?;
            let m =
                Method::from_bytes(b"MOVE").map_err(|e| AppError::protocol_error(e.to_string()))?;
            let resp = self
                .authenticated(client.request(m, &from_url))
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
            if self.client.is_none() {
                return false;
            }
            let url = self.url(&self.current_dir);
            tokio::time::timeout(
                Duration::from_secs(ConnectionPolicy::HealthProbeTimeoutSeconds.value()),
                self.request("PROPFIND", &url, Some(PROPFIND_BODY)),
            )
            .await
            .is_ok_and(|result| result.is_ok())
        }
    }

    /// 对 WebDAV href 中的百分号编码执行 UTF-8 解码。
    fn urlencoding_decode(s: &str) -> String {
        let mut result = Vec::with_capacity(s.len());
        let bytes = s.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'%' && i + 2 < bytes.len() {
                if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                    if let Ok(byte) = u8::from_str_radix(hex, 16) {
                        result.push(byte);
                        i += 3;
                        continue;
                    }
                }
            }
            result.push(bytes[i]);
            i += 1;
        }
        String::from_utf8_lossy(&result).into_owned()
    }

    #[cfg(test)]
    mod tests {
        use super::WebDavAdapter;
        use crate::enums::Protocol;
        use crate::models::RemoteHost;
        use uuid::Uuid;

        fn webdav_host(address: &str, port: u16, base_path: Option<&str>) -> RemoteHost {
            RemoteHost {
                id: Uuid::new_v4(),
                name: "WebDAV".to_string(),
                protocol: Protocol::WebDav,
                host: address.to_string(),
                port,
                username: "user".to_string(),
                password: String::new(),
                tags: String::new(),
                download_path: None,
                https: true,
                base_path: base_path.map(str::to_string),
                sftp_host_key_fingerprint: None,
                is_connected: false,
            }
        }

        #[test]
        fn builds_webdav_url_from_address_path_and_optional_base_path() {
            let host = webdav_host("https://dav.example.com/dav", 0, Some("/team"));
            assert_eq!(
                WebDavAdapter::build_base_url(&host).expect("valid URL"),
                "https://dav.example.com/dav/team"
            );

            let mut legacy = webdav_host("example.com", 8443, Some("/remote.php/dav"));
            legacy.https = false;
            assert_eq!(
                WebDavAdapter::build_base_url(&legacy).expect("valid legacy URL"),
                "http://example.com:8443/remote.php/dav"
            );
        }

        #[test]
        fn parses_namespaced_multistatus_and_utf8_paths() {
            let xml = r#"<?xml version="1.0" encoding="utf-8"?>
                <D:multistatus xmlns:D="DAV:">
                  <D:response>
                    <D:href>/files/</D:href>
                    <D:propstat><D:prop><D:displayname>files</D:displayname><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat>
                  </D:response>
                  <D:response>
                    <D:href>/files/%E6%B5%8B%E8%AF%95/</D:href>
                    <D:propstat><D:prop><D:displayname>%E6%B5%8B%E8%AF%95</D:displayname><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat>
                  </D:response>
                  <D:response>
                    <D:href>/files/a%26b.txt</D:href>
                    <D:propstat><D:prop><D:displayname>a&amp;b.txt</D:displayname><D:getcontentlength>42</D:getcontentlength><D:getlastmodified>Wed, 15 Jul 2026 01:02:03 GMT</D:getlastmodified></D:prop></D:propstat>
                  </D:response>
                </D:multistatus>"#;

            let files = WebDavAdapter::new()
                .parse_multistatus(xml, "/files/")
                .expect("valid multistatus should parse");

            assert_eq!(files.len(), 2);
            assert_eq!(files[0].name, "测试");
            assert_eq!(files[0].full_path, "/files/测试/");
            assert!(files[0].is_directory);
            assert_eq!(files[1].name, "a&b.txt");
            assert_eq!(files[1].size, 42);
            assert!(!files[1].is_directory);
        }
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

        async fn disconnect(&self) -> Result<(), AppError> {
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
