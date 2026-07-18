//! SFTP adapter。
//!
//! 启用 `sftp-adapter` feature 时：基于 russh + russh-sftp 的完整实现。
//! 未启用时：返回 unsupported 的 stub。

#[cfg(feature = "sftp-adapter")]
mod impl_ {
    use std::path::Path;
    use std::sync::Arc;

    use async_trait::async_trait;
    use russh::client::{self, Handle};
    use russh::Disconnect;
    use russh_sftp::client::SftpSession;
    use russh_sftp::protocol::OpenFlags;

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

    fn validate_transferred_length(total: Option<u64>, transferred: u64) -> Result<(), AppError> {
        match total {
            Some(total) if transferred != total => Err(AppError::protocol_error(format!(
                "SFTP 下载提前结束：预期 {} 字节，实际收到 {transferred} 字节",
                total
            ))),
            _ => Ok(()),
        }
    }

    fn format_owner(
        user: Option<&str>,
        group: Option<&str>,
        uid: Option<u32>,
        gid: Option<u32>,
    ) -> Option<String> {
        match (user, group, uid, gid) {
            (Some(user), Some(group), _, _) => Some(format!("{user}:{group}")),
            (Some(user), None, _, Some(gid)) => Some(format!("{user}:{gid}")),
            (None, Some(group), Some(uid), _) => Some(format!("{uid}:{group}")),
            (_, _, Some(uid), Some(gid)) => Some(format!("{uid}:{gid}")),
            (Some(user), None, _, _) => Some(user.to_string()),
            (None, Some(group), _, _) => Some(group.to_string()),
            (_, _, Some(uid), None) => Some(uid.to_string()),
            (_, _, None, Some(gid)) => Some(gid.to_string()),
            _ => None,
        }
    }

    fn format_unix_permissions(mode: u32) -> String {
        const PERMISSIONS: [(u32, char); 9] = [
            (0o400, 'r'),
            (0o200, 'w'),
            (0o100, 'x'),
            (0o040, 'r'),
            (0o020, 'w'),
            (0o010, 'x'),
            (0o004, 'r'),
            (0o002, 'w'),
            (0o001, 'x'),
        ];
        PERMISSIONS
            .iter()
            .map(|(bit, symbol)| if mode & bit != 0 { *symbol } else { '-' })
            .collect()
    }

    /// SFTP 主机密钥策略结果。
    #[derive(Debug, PartialEq, Eq)]
    enum HostKeyPolicy {
        Unknown,
        Changed { expected: String, actual: String },
    }

    fn evaluate_host_key(expected: Option<&str>, actual: &str) -> Result<(), HostKeyPolicy> {
        match expected {
            None => Err(HostKeyPolicy::Unknown),
            Some(expected) if expected == actual => Ok(()),
            Some(expected) => Err(HostKeyPolicy::Changed {
                expected: expected.to_string(),
                actual: actual.to_string(),
            }),
        }
    }

    #[derive(Debug, thiserror::Error)]
    enum SshHandlerError {
        #[error(transparent)]
        Russh(#[from] russh::Error),
        #[error("{0}")]
        App(AppError),
    }

    /// SFTP handler：在认证前执行个人版 TOFU 主机密钥校验。
    struct SshHandler {
        expected_fingerprint: Option<String>,
        host: String,
        port: u16,
    }

    impl client::Handler for SshHandler {
        type Error = SshHandlerError;

        async fn check_server_key(
            &mut self,
            key: &russh::keys::PublicKey,
        ) -> Result<bool, Self::Error> {
            let actual = key.fingerprint(russh::keys::HashAlg::Sha256).to_string();
            match evaluate_host_key(self.expected_fingerprint.as_deref(), &actual) {
                Ok(()) => Ok(true),
                Err(HostKeyPolicy::Unknown) => Err(SshHandlerError::App(
                    AppError::new(
                        ErrorCode::HostKeyUnknown,
                        format!(
                            "SFTP 主机 {}:{} 的密钥尚未信任，实际指纹: {actual}",
                            self.host, self.port
                        ),
                    )
                    .with_details(serde_json::json!({
                        "host": self.host,
                        "port": self.port,
                        "actualFingerprint": actual,
                    })),
                )),
                Err(HostKeyPolicy::Changed { expected, actual }) => Err(SshHandlerError::App(
                    AppError::new(
                        ErrorCode::HostKeyChanged,
                        format!(
                            "SFTP 主机 {}:{} 的密钥已变化，预期指纹: {expected}，实际指纹: {actual}",
                            self.host, self.port
                        ),
                    )
                    .with_details(serde_json::json!({
                        "host": self.host,
                        "port": self.port,
                        "expectedFingerprint": expected,
                        "actualFingerprint": actual,
                    })),
                )),
            }
        }
    }

    /// SFTP adapter。
    pub struct SftpAdapter {
        handle: Option<Handle<SshHandler>>,
        sftp: Option<SftpSession>,
        current_dir: String,
    }

    impl SftpAdapter {
        pub fn new() -> Self {
            Self {
                handle: None,
                sftp: None,
                current_dir: String::from("/"),
            }
        }

        fn sftp(&self) -> Result<&SftpSession, AppError> {
            self.sftp.as_ref().ok_or_else(AppError::not_connected)
        }
    }

    impl Default for SftpAdapter {
        fn default() -> Self {
            Self::new()
        }
    }

    #[async_trait]
    impl FileTransport for SftpAdapter {
        fn protocol(&self) -> Protocol {
            Protocol::Sftp
        }

        fn capabilities(&self) -> AdapterCapability {
            AdapterCapability::OWNER_PERMISSIONS
                | AdapterCapability::SYMLINKS
                | AdapterCapability::ATOMIC_RENAME
                | AdapterCapability::CHMOD
                | AdapterCapability::CHOWN
        }

        async fn connect(
            &mut self,
            host: &RemoteHost,
            password: Option<&str>,
        ) -> Result<(), AppError> {
            let port = host.effective_port();
            let addr = format!("{}:{}", host.host, port);

            let config = Arc::new(client::Config {
                keepalive_interval: Some(std::time::Duration::from_secs(
                    ConnectionPolicy::SshKeepaliveIntervalSeconds.value(),
                )),
                keepalive_max: ConnectionPolicy::SshKeepaliveMaxMisses.value() as usize,
                ..client::Config::default()
            });
            let handler = SshHandler {
                expected_fingerprint: host.sftp_host_key_fingerprint.clone(),
                host: host.host.clone(),
                port,
            };
            let mut handle = client::connect(config, addr.clone(), handler)
                .await
                .map_err(|error| match error {
                    SshHandlerError::App(error) => error,
                    SshHandlerError::Russh(error) => {
                        AppError::connection_failed(format!("SSH 连接失败 {addr}: {error}"))
                    }
                })?;

            let password = password.unwrap_or("");
            let auth = handle
                .authenticate_password(&host.username, password)
                .await
                .map_err(|e| AppError::new(crate::enums::ErrorCode::AuthFailed, e.to_string()))?;

            if !auth.success() {
                return Err(AppError::new(
                    crate::enums::ErrorCode::AuthFailed,
                    format!(
                        "SFTP 认证失败：服务器拒绝了用户“{}”的密码认证，请核对用户名、密码及服务器是否允许密码登录",
                        host.username
                    ),
                ));
            }

            let channel = handle
                .channel_open_session()
                .await
                .map_err(|e| AppError::protocol_error(format!("打开通道失败: {e}")))?;

            channel
                .request_subsystem(true, "sftp")
                .await
                .map_err(|e| AppError::protocol_error(format!("请求 SFTP 子系统失败: {e}")))?;

            let sftp = SftpSession::new(channel.into_stream())
                .await
                .map_err(|e| AppError::protocol_error(format!("SFTP 会话初始化失败: {e}")))?;

            let cwd = sftp
                .canonicalize(".")
                .await
                .unwrap_or_else(|_| "/".to_string());

            self.handle = Some(handle);
            self.sftp = Some(sftp);
            self.current_dir = cwd;
            Ok(())
        }

        async fn disconnect(&self) -> Result<(), AppError> {
            if let Some(sftp) = &self.sftp {
                let _ = sftp.close().await;
            }
            if let Some(handle) = &self.handle {
                let _ = handle.disconnect(Disconnect::ByApplication, "", "en").await;
            }
            Ok(())
        }

        async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError> {
            let sftp = self.sftp()?;
            let read_dir = sftp
                .read_dir(path)
                .await
                .map_err(|e| AppError::protocol_error(format!("读取目录失败 {path}: {e}")))?;

            let mut files = Vec::new();
            for entry in read_dir {
                let name = entry.file_name();
                let attrs = entry.metadata();
                let full_path = entry.path();

                let owner = format_owner(
                    attrs.user.as_deref(),
                    attrs.group.as_deref(),
                    attrs.uid,
                    attrs.gid,
                );
                let permissions = attrs.permissions.map(format_unix_permissions);

                let last_modified = attrs
                    .mtime
                    .map(|t| {
                        chrono::DateTime::from_timestamp(t as i64, 0)
                            .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                            .unwrap_or_default()
                    })
                    .unwrap_or_default();

                files.push(RemoteFile {
                    name,
                    full_path,
                    size: attrs.size.unwrap_or(0) as i64,
                    is_directory: attrs.is_dir(),
                    last_modified,
                    owner,
                    permissions,
                });
            }
            Ok(files)
        }

        async fn download_file(
            &self,
            remote_path: &str,
            local_path: &str,
            progress: ProgressTx,
        ) -> Result<(), AppError> {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};

            let sftp = self.sftp()?;
            let mut remote = sftp
                .open(remote_path)
                .await
                .map_err(|e| AppError::protocol_error(format!("打开远程文件失败: {e}")))?;

            let total = remote
                .metadata()
                .await
                .map_err(|e| AppError::protocol_error(format!("读取远程文件元数据失败: {e}")))?
                .size;
            let reported_total = total.unwrap_or(0);

            let mut local = AtomicDownloadFile::create(Path::new(local_path))
                .await
                .map_err(storage_write_error)?;
            let mut buf = vec![0u8; TransferPolicy::TransferBufferBytes.value() as usize];
            let mut transferred: u64 = 0;

            loop {
                let n = remote
                    .read(&mut buf)
                    .await
                    .map_err(|e| AppError::protocol_error(format!("读取远程文件失败: {e}")))?;
                if n == 0 {
                    break;
                }
                local
                    .file_mut()
                    .map_err(storage_write_error)?
                    .write_all(&buf[..n])
                    .await
                    .map_err(storage_write_error)?;
                transferred += n as u64;
                let _ = progress.try_send(ProgressEvent::Progress {
                    transferred,
                    total: reported_total,
                    current_file: remote_path.to_string(),
                });
            }
            validate_transferred_length(total, transferred)?;
            local.prepare().await.map_err(storage_write_error)?;
            let done_permit = reserve_after_final_event(
                &progress,
                ProgressEvent::Progress {
                    transferred,
                    total: reported_total,
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
            use tokio::io::{AsyncReadExt, AsyncWriteExt};

            let sftp = self.sftp()?;
            let mut remote = sftp
                .open_with_flags(
                    remote_path,
                    OpenFlags::CREATE | OpenFlags::WRITE | OpenFlags::TRUNCATE,
                )
                .await
                .map_err(|e| AppError::protocol_error(format!("打开远程文件失败: {e}")))?;

            let mut local = tokio::fs::File::open(local_path).await?;
            let total = local.metadata().await.map(|m| m.len()).unwrap_or(0);
            let mut buf = vec![0u8; TransferPolicy::TransferBufferBytes.value() as usize];
            let mut transferred: u64 = 0;

            loop {
                let n = local.read(&mut buf).await?;
                if n == 0 {
                    break;
                }
                remote
                    .write_all(&buf[..n])
                    .await
                    .map_err(|e| AppError::protocol_error(format!("写入远程文件失败: {e}")))?;
                transferred += n as u64;
                let _ = progress.try_send(ProgressEvent::Progress {
                    transferred,
                    total,
                    current_file: remote_path.to_string(),
                });
            }
            let _ = progress.send(ProgressEvent::Done).await;
            Ok(())
        }

        async fn delete_file(&self, path: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            sftp.remove_file(path)
                .await
                .map_err(|e| AppError::protocol_error(format!("删除文件失败 {path}: {e}")))
        }

        async fn delete_directory(&self, path: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            let mut pending = vec![(path.to_string(), false)];
            while let Some((current_path, visited)) = pending.pop() {
                if visited {
                    sftp.remove_dir(&current_path).await.map_err(|e| {
                        AppError::protocol_error(format!("删除目录失败 {current_path}: {e}"))
                    })?;
                    continue;
                }

                pending.push((current_path.clone(), true));
                let entries = sftp.read_dir(&current_path).await.map_err(|e| {
                    AppError::protocol_error(format!("读取待删除目录失败 {current_path}: {e}"))
                })?;
                for entry in entries {
                    if matches!(entry.file_name().as_str(), "." | "..") {
                        continue;
                    }
                    if entry.metadata().is_dir() {
                        pending.push((entry.path(), false));
                    } else {
                        let entry_path = entry.path();
                        sftp.remove_file(&entry_path).await.map_err(|e| {
                            AppError::protocol_error(format!("删除文件失败 {entry_path}: {e}"))
                        })?;
                    }
                }
            }
            Ok(())
        }

        async fn create_directory(&self, path: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            sftp.create_dir(path)
                .await
                .map_err(|e| AppError::protocol_error(format!("创建目录失败 {path}: {e}")))
        }

        async fn move_file(&self, from: &str, to: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            sftp.rename(from, to)
                .await
                .map_err(|e| AppError::protocol_error(format!("移动/重命名失败 {from}→{to}: {e}")))
        }

        async fn get_working_dir(&self) -> Result<String, AppError> {
            Ok(self.current_dir.clone())
        }

        async fn change_dir(&mut self, path: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            let _ = sftp
                .metadata(path)
                .await
                .map_err(|e| AppError::protocol_error(format!("目录不存在 {path}: {e}")))?;
            self.current_dir = path.to_string();
            Ok(())
        }

        async fn is_connected(&self) -> bool {
            self.sftp.is_some()
                && self
                    .handle
                    .as_ref()
                    .is_some_and(|handle| !handle.is_closed())
        }
    }

    #[cfg(test)]
    mod tests {
        use super::{
            evaluate_host_key, format_owner, format_unix_permissions, validate_transferred_length,
            HostKeyPolicy,
        };
        use crate::enums::ErrorCode;

        #[test]
        fn host_key_policy_rejects_unknown_accepts_exact_and_rejects_changed() {
            let unknown = evaluate_host_key(None, "SHA256:actual").expect_err("unknown must fail");
            assert_eq!(unknown, HostKeyPolicy::Unknown);
            assert_eq!(
                evaluate_host_key(Some("SHA256:actual"), "SHA256:actual"),
                Ok(())
            );
            let changed = evaluate_host_key(Some("SHA256:expected"), "SHA256:actual")
                .expect_err("changed must fail");
            assert_eq!(
                changed,
                HostKeyPolicy::Changed {
                    expected: "SHA256:expected".to_string(),
                    actual: "SHA256:actual".to_string(),
                }
            );
        }

        #[test]
        fn formats_owner_names_with_numeric_fallback() {
            assert_eq!(
                format_owner(Some("deploy"), Some("staff"), Some(1000), Some(1000)),
                Some("deploy:staff".to_string())
            );
            assert_eq!(
                format_owner(None, None, Some(1000), Some(1001)),
                Some("1000:1001".to_string())
            );
        }

        #[test]
        fn rejects_sftp_downloads_that_end_before_the_reported_length() {
            assert!(validate_transferred_length(Some(42), 42).is_ok());
            assert!(validate_transferred_length(None, 12).is_ok());
            let error = validate_transferred_length(Some(42), 12).expect_err("early EOF must fail");
            assert_eq!(error.code, ErrorCode::ProtocolError);
        }

        #[test]
        fn formats_symbolic_unix_permissions() {
            assert_eq!(format_unix_permissions(0o755), "rwxr-xr-x");
            assert_eq!(format_unix_permissions(0o670), "rw-rwx---");
        }
    }
}

#[cfg(feature = "sftp-adapter")]
pub use impl_::SftpAdapter;

// ============================================================
// Stub 实现（未启用 feature）
// ============================================================
#[cfg(not(feature = "sftp-adapter"))]
mod stub {
    use async_trait::async_trait;

    use crate::enums::{AdapterCapability, Protocol};
    use crate::error::AppError;
    use crate::models::{RemoteFile, RemoteHost};
    use crate::transport::{FileTransport, ProgressTx};

    pub struct SftpAdapter;

    impl SftpAdapter {
        pub fn new() -> Self {
            Self
        }
    }

    impl Default for SftpAdapter {
        fn default() -> Self {
            Self::new()
        }
    }

    fn unsupported() -> AppError {
        AppError::unsupported("SFTP adapter 未启用（需 sftp-adapter feature）")
    }

    #[async_trait]
    impl FileTransport for SftpAdapter {
        fn protocol(&self) -> Protocol {
            Protocol::Sftp
        }

        fn capabilities(&self) -> AdapterCapability {
            AdapterCapability::OWNER_PERMISSIONS
                | AdapterCapability::SYMLINKS
                | AdapterCapability::ATOMIC_RENAME
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

#[cfg(not(feature = "sftp-adapter"))]
pub use stub::SftpAdapter;
