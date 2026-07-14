//! SFTP adapter。
//!
//! 启用 `sftp-adapter` feature 时：基于 russh + russh-sftp 的完整实现。
//! 未启用时：返回 unsupported 的 stub。

// ============================================================
// 完整实现（feature = "sftp-adapter"）
// ============================================================
#[cfg(feature = "sftp-adapter")]
mod impl_ {
    use std::sync::Arc;

    use async_trait::async_trait;
    use russh::client::{self, Handle};
    use russh::Disconnect;
    use russh_sftp::client::SftpSession;
    use russh_sftp::protocol::OpenFlags;

    use crate::enums::{AdapterCapability, Protocol};
    use crate::error::AppError;
    use crate::models::{RemoteFile, RemoteHost};
    use crate::transport::{FileTransport, ProgressEvent, ProgressTx};

    /// SFTP handler（接受所有服务器密钥，Phase 2 加 known_hosts 验证）。
    struct SshHandler;

    impl client::Handler for SshHandler {
        type Error = russh::Error;

        async fn check_server_key(
            &mut self,
            _key: &russh::keys::PublicKey,
        ) -> Result<bool, Self::Error> {
            Ok(true)
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

            let config = Arc::new(client::Config::default());
            let mut handle = client::connect(config, addr.clone(), SshHandler)
                .await
                .map_err(|e| AppError::connection_failed(format!("SSH 连接失败 {addr}: {e}")))?;

            let password = password.unwrap_or("");
            let auth_ok = handle
                .authenticate_password(&host.username, password)
                .await
                .map_err(|e| {
                    AppError::new(crate::enums::ErrorCode::AuthFailed, e.to_string())
                })?;

            if !auth_ok {
                return Err(AppError::new(
                    crate::enums::ErrorCode::AuthFailed,
                    "SFTP 认证失败：用户名或密码错误",
                ));
            }

            let mut channel = handle.channel_open_session().await.map_err(|e| {
                AppError::protocol_error(format!("打开通道失败: {e}"))
            })?;

            channel
                .request_subsystem(true, "sftp")
                .await
                .map_err(|e| {
                    AppError::protocol_error(format!("请求 SFTP 子系统失败: {e}"))
                })?;

            let sftp = SftpSession::new(channel.into_stream())
                .await
                .map_err(|e| {
                    AppError::protocol_error(format!("SFTP 会话初始化失败: {e}"))
                })?;

            let cwd = sftp
                .canonicalize(".")
                .await
                .ok()
                .and_then(|p| {
                    p.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .or_else(|| Some(p.to_string_lossy().to_string()))
                })
                .unwrap_or_else(|| "/".to_string());

            self.handle = Some(handle);
            self.sftp = Some(sftp);
            self.current_dir = cwd;
            Ok(())
        }

        async fn disconnect(&mut self) -> Result<(), AppError> {
            self.sftp = None;
            if let Some(mut handle) = self.handle.take() {
                let _ = handle.disconnect(Disconnect::ByApplication, "", "en").await;
            }
            Ok(())
        }

        async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError> {
            let sftp = self.sftp()?;
            let entries = sftp.read_dir(path).await.map_err(|e| {
                AppError::protocol_error(format!("读取目录失败 {path}: {e}"))
            })?;

            let mut files = Vec::with_capacity(entries.len());
            for entry in entries {
                let name = entry.file_name();
                if name == "." || name == ".." {
                    continue;
                }
                let attrs = entry.metadata();
                let full_path = if path.ends_with('/') {
                    format!("{path}{name}")
                } else {
                    format!("{path}/{name}")
                };

                let owner = attrs.owner.as_ref().map(|o| {
                    attrs
                        .group
                        .as_ref()
                        .map(|g| format!("{o}:{g}"))
                        .unwrap_or_else(|| o.clone())
                });

                let permissions = attrs.permissions.as_ref().map(|p| {
                    format!(
                        "{}{}{}{}{}{}{}{}{}{}",
                        if attrs.is_dir() { "d" } else { "-" },
                        if p.owner_read { "r" } else { "-" },
                        if p.owner_write { "w" } else { "-" },
                        if p.owner_execute { "x" } else { "-" },
                        if p.group_read { "r" } else { "-" },
                        if p.group_write { "w" } else { "-" },
                        if p.group_execute { "x" } else { "-" },
                        if p.other_read { "r" } else { "-" },
                        if p.other_write { "w" } else { "-" },
                        if p.other_execute { "x" } else { "-" },
                    )
                });

                let last_modified = attrs
                    .mtime
                    .map(|t| {
                        chrono::DateTime::from_timestamp(t, 0)
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
            let sftp = self.sftp()?;
            let mut remote = sftp.open(remote_path).await.map_err(|e| {
                AppError::protocol_error(format!("打开远程文件失败: {e}"))
            })?;

            let total = remote
                .metadata()
                .await
                .ok()
                .and_then(|a| a.size)
                .unwrap_or(0);

            let mut local = tokio::fs::File::create(local_path).await?;
            let mut buf = vec![0u8; 64 * 1024];
            let mut transferred: u64 = 0;

            loop {
                use tokio::io::AsyncReadExt;
                let n = remote
                    .read(&mut buf)
                    .await
                    .map_err(|e| AppError::protocol_error(format!("读取远程文件失败: {e}")))?;
                if n == 0 {
                    break;
                }
                tokio::io::AsyncWriteExt::write_all(&mut local, &buf[..n]).await?;
                transferred += n as u64;
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
            let mut buf = vec![0u8; 64 * 1024];
            let mut transferred: u64 = 0;

            loop {
                use tokio::io::AsyncReadExt;
                let n = local.read(&mut buf).await?;
                if n == 0 {
                    break;
                }
                remote.write_all(&buf[..n]).await.map_err(|e| {
                    AppError::protocol_error(format!("写入远程文件失败: {e}"))
                })?;
                transferred += n as u64;
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

        async fn delete_file(&self, path: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            sftp.remove_file(path)
                .await
                .map_err(|e| AppError::protocol_error(format!("删除文件失败 {path}: {e}")))
        }

        async fn delete_directory(&self, path: &str) -> Result<(), AppError> {
            let sftp = self.sftp()?;
            sftp.remove_dir(path)
                .await
                .map_err(|e| AppError::protocol_error(format!("删除目录失败 {path}: {e}")))
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
            let _ = sftp.metadata(path).await.map_err(|e| {
                AppError::protocol_error(format!("目录不存在 {path}: {e}"))
            })?;
            self.current_dir = path.to_string();
            Ok(())
        }

        async fn is_connected(&self) -> bool {
            self.sftp.is_some()
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

    /// SFTP adapter stub（未启用 sftp-adapter feature）。
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

#[cfg(not(feature = "sftp-adapter"))]
pub use stub::SftpAdapter;
