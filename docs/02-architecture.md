# SY-TFM — 架构文档

**项目名称:** SY-TFM (Tiny File Manager)  
**日期:** 2026-07-05  
**状态:** Draft  

---

## 1. 架构概览

### 1.1 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                       Tauri 2 Shell                          │
│  ┌────────────────────────┐  ┌───────────────────────────┐  │
│  │    Frontend (Web)      │  │    Backend (Rust)         │  │
│  │                        │  │                           │  │
│  │  React 18 + TS         │◄─┤  Tauri Commands           │  │
│  │  Tailwind + shadcn     │  │  Tokio Async Runtime      │  │
│  │  Zustand (State)       │  │                           │  │
│  │  TanStack Query        │  │  ┌─────────────────────┐  │  │
│  │                        │  │  │   Session Manager    │  │  │
│  │  ◄─ Tauri IPC ──►     │  │  │   (trait 对象调度)    │  │  │
│  │                        │  │  └──────────┬──────────┘  │  │
│  │  ◄─ Events ─────►     │  │             │              │  │
│  │                        │  │  ┌──────────▼──────────┐  │  │
│  └────────────────────────┘  │  │  FileTransport Trait │  │  │
│                              │  │  (协议抽象层)         │  │  │
│                              │  └──────────┬──────────┘  │  │
│                              │     ┌────────┼────────┐    │  │
│                              │     │        │        │    │  │
│                              │  ┌──▼──┐ ┌───▼───┐ ┌──▼─┐  │  │
│                              │  │SFTP │ │WebDAV │ │... │  │  │
│                              │  │Adapt│ │Adapt  │ │Adapt│ │  │
│                              │  │russh│ │reqwest│ │    │  │  │
│                              │  └─────┘ └───────┘ └────┘  │  │
│                              │  ┌─────────────────────┐   │  │
│                              │  │   enums/ (全局枚举)  │   │  │
│                              │  └─────────────────────┘   │  │
│                              │  ┌─────────────────────┐   │  │
│                              │  │   crypto/           │   │  │
│                              │  │   storage/          │   │  │
│                              │  │   file_watcher/     │   │  │
│                              │  └─────────────────────┘   │  │
│                              └───────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Platform Layer                        │ │
│  │   Windows │ macOS │ Linux │ iOS │ Android              │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

1. **协议抽象优先**：FileTransport trait 是所有协议交互的唯一接口，上层代码零协议感知
2. **Adapter 可插拔**：新增协议 = 新增 adapter 文件 + 枚举注册，不修改任何现有代码
3. **枚举即真理源**：所有常量收敛至全局 `enums/` 目录，禁止魔法字符串
4. **前后端分离**：前端只负责 UI 渲染和交互，所有业务逻辑在 Rust 后端
5. **类型安全**：使用 `ts-rs` 从 Rust 结构体和枚举自动生成 TypeScript 类型
6. **异步优先**：所有 IO 操作异步，使用 Tokio runtime
7. **能力声明驱动**：每个 adapter 声明自身能力，UI 根据能力动态适配

---

## 2. 技术选型

### 2.1 后端 (Rust)

| 领域 | Crate | 版本 | 选型理由 |
|------|-------|------|----------|
| 异步运行时 | tokio | 1.47 | Rust 标准异步运行时 |
| SSH/SFTP | russh | 0.62.2 | 纯 Rust SSH 实现，跨平台友好（MSRV 1.85） |
| HTTP/WebDAV | reqwest | 0.12 | HTTP 客户端，支持 WebDAV |
| XML 解析 | quick-xml | 0.38 | WebDAV PROPFIND 响应解析 |
| 加密 | aes-gcm | 0.10 | AES-256-GCM |
| 密钥派生 | argon2 | 0.5 | 本地密码加密 |
| 序列化 | serde | 1.0 | JSON 序列化 |
| JSON | serde_json | 1.0 | JSON 支持 |
| 类型导出 | ts-rs | 11 | Rust → TypeScript 类型自动生成 |
| 文件监听 | notify | 8 | 跨平台文件监听 |
| 文件锁 | fs2 | 0.4 | 跨实例保护 Remote Edit 活动临时目录 |
| 日志 | tracing | 0.1 | 结构化日志 |
| 应用错误 | anyhow | 1 | 应用错误处理 |
| 库错误定义 | thiserror | 2 | 库错误定义 |
| 平台密钥存储 | keyring | 3 | Keychain / DPAPI |
| UUID | uuid | 1 | 唯一 ID |
| 配置目录 | directories | 6 | AppData / ~/.config |
| 高性能锁 | parking_lot | 0.12 | Mutex / RwLock |

> **注意：** FTP/FTPS adapter 不在首版范围。后续添加时引入 `suppaftp` crate，封装为 `FtpAdapter`，不影响现有代码。

### 2.2 前端 (React)

| 领域 | 库 | 版本 | 选型理由 |
|------|----|------|----------|
| UI 框架 | react | 19.1 | 最新稳定版 |
| React DOM | react-dom | 19.1 | React 渲染 |
| 构建工具 | vite | 7.1 | 极速构建 |
| Tauri API | @tauri-apps/api | 2.8 | Tauri 官方 API |
| TypeScript | typescript | 5.9 | 类型安全 |
| 样式 | tailwindcss | 4.1 | 最新 Tailwind |
| Vite 插件 | @tailwindcss/vite | 4.1 | Tailwind 官方插件 |
| UI 组件 | shadcn/ui | latest | 基于 Radix，可定制 |
| 状态管理 | zustand | 5.0 | 轻量状态管理 |
| 服务端状态 | @tanstack/react-query | 5.8x | Cache / Retry |
| 路由 | react-router | 7.8 | 官方 Router |
| 国际化 | i18next | 25 | 国际化 |
| React i18n | react-i18next | 15 | React 集成 |
| 图标 | lucide-react | 0.54x | Tree Shake |
| 编辑器 | @uiw/react-codemirror | 4.24 | 文本编辑 |
| 虚拟列表 | @tanstack/react-virtual | 3.13 | 大文件列表 |
| 拖拽基础 | @dnd-kit/core | 6.3 | 文件与主机拖拽 |
| 列表排序 | @dnd-kit/sortable | 10.0 | 主机列表实时让位排序 |
| 拖拽约束 | @dnd-kit/modifiers | 9.0 | 主机排序锁定垂直轴 |
| 拖拽变换 | @dnd-kit/utilities | 3.2 | 安全生成实时位移 transform |
| Toast | sonner | 2.0 | 消息通知 |
| 表单 | react-hook-form | 7.62 | 表单管理 |
| 数据校验 | zod | 4.1 | Schema 校验 |
| Class 合并 | clsx | 2.1 | className 工具 |
| Tailwind Merge | tailwind-merge | 3.3 | Tailwind class 合并 |
| Variant 管理 | class-variance-authority | 0.7 | 组件 Variant |

### 2.3 前端开发依赖 (DevDependencies)

| 领域 | 库 | 版本 | 选型理由 |
|------|----|------|----------|
| 代码规范 | eslint | 9.35 | 代码静态检查 |
| React 规范 | eslint-plugin-react-hooks | 5.x | Hooks 规则检查 |
| TypeScript 规范 | typescript-eslint | 8.x | TS 静态检查 |
| 代码格式化 | prettier | 3.6 | 统一代码风格 |
| Tailwind 排序 | prettier-plugin-tailwindcss | 0.6 | Tailwind class 排序 |

### 2.4 Tauri 插件

| 插件 | 用途 |
|------|------|
| @tauri-apps/plugin-dialog | 原生文件/文件夹选择对话框 |
| @tauri-apps/plugin-fs | 本地文件系统访问 |
| @tauri-apps/plugin-shell | 打开外部编辑器 |
| @tauri-apps/plugin-os | 平台检测 |
| @tauri-apps/plugin-clipboard-manager | 剪贴板操作 |
| @tauri-apps/plugin-notification | 系统通知 |
| @tauri-apps/plugin-haptics | 移动端振动反馈 |
| @tauri-apps/plugin-share | 移动端文件分享 |

---

## 3. FileTransport Adapter 架构

### 3.1 核心设计

```
                    ┌─────────────────────────┐
                    │    SessionManager       │
                    │  (管理所有连接会话)      │
                    └────────────┬────────────┘
                                 │
                                 │  Box<dyn FileTransport>
                                 │
                    ┌────────────▼────────────┐
                    │   FileTransport Trait   │
                    │   (协议抽象层)           │
                    │                         │
                    │   connect()             │
                    │   disconnect()          │
                    │   list_directory()      │
                    │   download_file()       │
                    │   upload_file()         │
                    │   delete_file()         │
                    │   delete_directory()    │
                    │   create_directory()    │
                    │   move_file()           │
                    │   rename_file()         │
                    │   get_working_dir()     │
                    │   change_dir()          │
                    │   is_connected()        │
                    │   capabilities()        │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
   ┌──────────▼─────────┐ ┌─────▼──────┐  ┌───────▼───────┐
   │   SftpAdapter       │ │WebDavAdapter│  │  FtpAdapter   │
   │   (russh)           │ │(reqwest)    │  │  (suppaftp)   │
   │   ✅ 首版实现        │ │ ✅ 首版实现  │  │  📋 后续迭代   │
   └────────────────────┘ └────────────┘  └───────────────┘
```

### 3.2 FileTransport Trait 定义

```rust
// src-tauri/src/transport/mod.rs

use async_trait::async_trait;
use crate::enums::{Protocol, AdapterCapability};
use crate::models::{RemoteHost, RemoteFile};
use crate::error::AppError;

/// 进度回调通道
pub type ProgressTx = tokio::sync::mpsc::Sender<ProgressEvent>;

/// 文件传输协议抽象层
/// 
/// 所有协议 adapter 必须实现此 trait。
/// 上层代码（SessionManager、Commands）仅依赖此 trait，
/// 不感知具体协议实现。
#[async_trait]
pub trait FileTransport: Send + Sync {
    /// 返回协议类型
    fn protocol(&self) -> Protocol;

    /// 返回 adapter 支持的能力
    fn capabilities(&self) -> AdapterCapability;

    /// 连接远程主机
    async fn connect(&mut self, host: &RemoteHost, password: Option<&str>) -> Result<(), AppError>;

    /// 断开连接
    async fn disconnect(&mut self) -> Result<(), AppError>;

    /// 列出目录内容
    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError>;

    /// 下载文件（支持进度回调）
    async fn download_file(
        &self,
        remote_path: &str,
        local_path: &str,
        progress: ProgressTx,
    ) -> Result<(), AppError>;

    /// 上传文件（支持进度回调）
    async fn upload_file(
        &self,
        local_path: &str,
        remote_path: &str,
        progress: ProgressTx,
    ) -> Result<(), AppError>;

    /// 删除文件
    async fn delete_file(&self, path: &str) -> Result<(), AppError>;

    /// 删除目录（递归）
    async fn delete_directory(&self, path: &str) -> Result<(), AppError>;

    /// 创建目录
    async fn create_directory(&self, path: &str) -> Result<(), AppError>;

    /// 移动/重命名文件或目录
    async fn move_file(&self, from: &str, to: &str) -> Result<(), AppError>;

    /// 获取当前工作目录
    async fn get_working_dir(&self) -> Result<String, AppError>;

    /// 切换工作目录
    async fn change_dir(&mut self, path: &str) -> Result<(), AppError>;

    /// 检查连接是否活跃
    async fn is_connected(&self) -> bool;
}

/// Adapter 工厂：根据协议创建对应 adapter
pub fn create_adapter(protocol: Protocol) -> Box<dyn FileTransport> {
    match protocol {
        Protocol::Sftp => Box::new(SftpAdapter::new()),
        Protocol::WebDav => Box::new(WebDavAdapter::new()),
        // 后续迭代：
        // Protocol::Ftp => Box::new(FtpAdapter::new()),
        // Protocol::S3 => Box::new(S3Adapter::new()),
        _ => panic!("Unsupported protocol: {:?}", protocol),
    }
    }
```

所有 `PROPFIND` 必须显式发送有限 `Depth`：目录列表使用 `1`，连接验证、切换目录验证与
健康探测使用 `0`，禁止依赖 RFC 4918 的缺省 `infinity`。Multistatus 中的 `href` 是服务端
URL 路径，adapter 必须先移除 WebDAV 服务根路径（例如 `/dav`），转换为应用逻辑路径，
并仅保留当前目录的直属子项；上层不得接触或重复拼接服务根路径。

### 3.3 Adapter 实现示例

#### SftpAdapter (russh)

```rust
// src-tauri/src/transport/sftp_adapter.rs

use russh::{client, ChannelMsg};
use russh_sftp::client::SftpSession;
use async_trait::async_trait;

pub struct SftpAdapter {
    session: Option<client::Handle>,
    sftp: Option<SftpSession>,
    current_path: String,
}

impl SftpAdapter {
    pub fn new() -> Self {
        Self {
            session: None,
            sftp: None,
            current_path: String::new(),
        }
    }
}

#[async_trait]
impl FileTransport for SftpAdapter {
    fn protocol(&self) -> Protocol {
        Protocol::Sftp
    }

    fn capabilities(&self) -> AdapterCapability {
        AdapterCapability::OWNER_PERMISSIONS  // SFTP 支持所有者/权限
            | AdapterCapability::SYMLINKS
            | AdapterCapability::ATOMIC_RENAME
    }

    async fn connect(&mut self, host: &RemoteHost, password: Option<&str>) -> Result<(), AppError> {
        // russh 连接逻辑...
        # Ok(())
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError> {
        // russh_sftp readdir 逻辑...
        # Ok(vec![])
    }

    // ... 其他方法实现
}
```

#### WebDavAdapter (reqwest)

```rust
// src-tauri/src/transport/webdav_adapter.rs

use reqwest::{Client, Method};
use quick_xml::de::from_str;

pub struct WebDavAdapter {
    client: Option<Client>,
    base_url: String,
    current_path: String,
}

impl WebDavAdapter {
    pub fn new() -> Self {
        Self {
            client: None,
            base_url: String::new(),
            current_path: String::new(),
        }
    }

    /// 构造 WebDAV 请求 URL
    fn build_url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }
}

#[async_trait]
impl FileTransport for WebDavAdapter {
    fn protocol(&self) -> Protocol {
        Protocol::WebDav
    }

    fn capabilities(&self) -> AdapterCapability {
        AdapterCapability::NONE  // WebDAV 基础能力，无 owner/permissions
    }

    async fn connect(&mut self, host: &RemoteHost, password: Option<&str>) -> Result<(), AppError> {
        let scheme = if host.port == 443 || host.https { "https" } else { "http" };
        self.base_url = format!("{}://{}:{}", scheme, host.host, host.port);

        let mut builder = Client::builder()
            .timeout(std::time::Duration::from_secs(30));

        // Basic Auth
        if !host.username.is_empty() {
            let pwd = password.unwrap_or(&host.password);
            builder = builder.default_auth(reqwest::auth::BasicAuth::new(
                host.username.clone().into(),
                Some(pwd.clone().into()),
            ));
        }

        self.client = Some(builder.build()?);

        // 验证连接：发送 PROPFIND 请求到根路径
        self.list_directory("/").await?;
        Ok(())
    }

    async fn list_directory(&self, path: &str) -> Result<Vec<RemoteFile>, AppError> {
        let client = self.client.as_ref().ok_or(AppError::NotConnected)?;
        let url = self.build_url(path);

        // WebDAV PROPFIND 请求
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
            <propfind xmlns="DAV:">
                <prop>
                    <displayname/>
                    <getcontentlength/>
                    <getlastmodified/>
                    <resourcetype/>
                </prop>
            </propfind>"#;

        let resp = client
            .request(Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Depth", "1")
            .body(body)
            .send()
            .await?;

        let xml = resp.text().await?;
        let entries: WebDavPropFind = from_str(&xml)?;

        // 转换为 RemoteFile 列表
        Ok(entries.to_remote_files(path))
    }

    async fn download_file(&self, remote_path: &str, local_path: &str, progress: ProgressTx) -> Result<(), AppError> {
        let client = self.client.as_ref().ok_or(AppError::NotConnected)?;
        let url = self.build_url(remote_path);

        let resp = client.get(&url).send().await?;
        let total = resp.content_length().unwrap_or(0);
        let mut file = tokio::fs::File::create(local_path).await?;
        let mut stream = resp.bytes_stream();
        let mut transferred: u64 = 0;

        use tokio::io::AsyncWriteExt;
        use futures_util::StreamExt;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            transferred += chunk.len() as u64;
            let _ = progress.send(ProgressEvent::Progress { transferred, total }).await;
        }

        Ok(())
    }

    async fn upload_file(&self, local_path: &str, remote_path: &str, progress: ProgressTx) -> Result<(), AppError> {
        let client = self.client.as_ref().ok_or(AppError::NotConnected)?;
        let url = self.build_url(remote_path);
        let data = tokio::fs::read(local_path).await?;

        let resp = client.put(&url).body(data).send().await?;
        if !resp.status().is_success() {
            return Err(AppError::Protocol(format!("Upload failed: {}", resp.status())));
        }
        Ok(())
    }

    async fn delete_file(&self, path: &str) -> Result<(), AppError> {
        let client = self.client.as_ref().ok_or(AppError::NotConnected)?;
        let url = self.build_url(path);
        client.delete(&url).send().await?;
        Ok(())
    }

    async fn delete_directory(&self, path: &str) -> Result<(), AppError> {
        // WebDAV DELETE 递归删除目录
        self.delete_file(path).await
    }

    async fn create_directory(&self, path: &str) -> Result<(), AppError> {
        let client = self.client.as_ref().ok_or(AppError::NotConnected)?;
        let url = self.build_url(path);
        client.request(Method::from_bytes(b"MKCOL").unwrap(), &url)
            .send().await?;
        Ok(())
    }

    async fn move_file(&self, from: &str, to: &str) -> Result<(), AppError> {
        let client = self.client.as_ref().ok_or(AppError::NotConnected)?;
        let from_url = self.build_url(from);
        let to_url = self.build_url(to);
        client.request(Method::from_bytes(b"MOVE").unwrap(), &from_url)
            .header("Destination", &to_url)
            .send().await?;
        Ok(())
    }

    async fn get_working_dir(&self) -> Result<String, AppError> {
        Ok(self.current_path.clone())
    }

    async fn change_dir(&mut self, path: &str) -> Result<(), AppError> {
        self.current_path = path.to_string();
        Ok(())
    }

    async fn is_connected(&self) -> bool {
        let url = self.build_url(&self.current_path);
        tokio::time::timeout(health_probe_timeout(), self.propfind(&url))
            .await
            .is_ok_and(|result| result.is_ok())
    }
}
```

`is_connected()` 必须反映 adapter 的真实连接状态，而不是只判断客户端对象是否仍存在。
SFTP 检查 russh 后台会话通道是否关闭；WebDAV 对当前目录执行带超时且 `Depth: 0` 的 PROPFIND。
SessionManager 以会话实例身份做条件清理，旧探测结果不得删除同一主机刚建立的新会话。

### 3.4 Adapter 能力声明

```rust
// src-tauri/src/enums/adapter_capability.rs

use bitflags::bitflags;

bitflags::bitflags! {
    /// Adapter 能力标志位
    /// 
    /// 上层 UI 根据能力标志决定是否显示某些列或操作选项。
    /// 例如：WebDAV 不支持 owner/permissions，UI 应隐藏这些列。
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
    #[ts(export, export_to = "../src/types/enums/")]
    pub struct AdapterCapability: u32 {
        /// 无特殊能力
        const NONE = 0;
        /// 支持 owner/group 信息
        const OWNER_PERMISSIONS = 1 << 0;
        /// 支持符号链接
        const SYMLINKS = 1 << 1;
        /// 支持原子重命名
        const ATOMIC_RENAME = 1 << 2;
        /// 支持文件权限修改
        const CHMOD = 1 << 3;
        /// 支持文件所有者修改
        const CHOWN = 1 << 4;
        /// 支持断点续传
        const RANGE_TRANSFER = 1 << 5;
    }
}
```

---

## 4. 全局枚举目录

### 4.1 设计理念

- 所有常量、状态码、类型标识符**必须**定义为枚举
- 禁止在代码中出现魔法字符串（如 `"sftp"`, `"connected"`, `"light"` 等）
- 枚举定义是全项目唯一的真理源
- Rust 枚举通过 `ts-rs` 自动生成 TypeScript 对应类型

### 4.2 Rust 枚举目录结构

```
src-tauri/src/enums/
├── mod.rs                    # 模块注册，re-export 所有枚举
├── protocol.rs               # Protocol 枚举
├── connection_status.rs      # ConnectionStatus 枚举
├── theme.rs                  # Theme 枚举
├── language.rs               # Language 枚举
├── sort_column.rs            # SortColumn 枚举
├── sort_order.rs             # SortOrder 枚举
├── error_code.rs             # ErrorCode 枚举
├── file_operation.rs         # FileOperation 枚举
├── edit_mode.rs              # EditMode 枚举
├── platform.rs               # Platform 枚举
├── transfer_direction.rs     # TransferDirection 枚举
└── adapter_capability.rs     # AdapterCapability 位标志
```

### 4.3 TypeScript 枚举目录结构

```
src/types/enums/
├── index.ts                  # re-export 所有枚举
├── Protocol.ts               # ts-rs 自动生成
├── ConnectionStatus.ts       # ts-rs 自动生成
├── Theme.ts                  # ts-rs 自动生成
├── Language.ts               # ts-rs 自动生成
├── SortColumn.ts             # ts-rs 自动生成
├── SortOrder.ts              # ts-rs 自动生成
├── ErrorCode.ts              # ts-rs 自动生成
├── FileOperation.ts          # ts-rs 自动生成
├── EditMode.ts               # ts-rs 自动生成
├── Platform.ts               # ts-rs 自动生成
├── TransferDirection.ts      # ts-rs 自动生成
└── AdapterCapability.ts      # ts-rs 自动生成
```

### 4.4 枚举定义示例

```rust
// src-tauri/src/enums/mod.rs
pub mod protocol;
pub mod connection_status;
pub mod theme;
pub mod language;
pub mod sort_column;
pub mod sort_order;
pub mod error_code;
pub mod file_operation;
pub mod edit_mode;
pub mod platform;
pub mod transfer_direction;
pub mod adapter_capability;

pub use protocol::Protocol;
pub use connection_status::ConnectionStatus;
pub use theme::Theme;
pub use language::Language;
pub use sort_column::SortColumn;
pub use sort_order::SortOrder;
pub use error_code::ErrorCode;
pub use file_operation::FileOperation;
pub use edit_mode::EditMode;
pub use platform::Platform;
pub use transfer_direction::TransferDirection;
pub use adapter_capability::AdapterCapability;


// src-tauri/src/enums/protocol.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// 支持的远程文件传输协议
/// 
/// 新增协议时：
/// 1. 在此枚举添加变体
/// 2. 在 transport/ 目录新建 adapter 文件
/// 3. 在 create_adapter() 工厂函数注册
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    /// SFTP - SSH File Transfer Protocol
    Sftp,
    /// WebDAV - Web Distributed Authoring and Versioning
    WebDav,
    /// FTP / FTPS - File Transfer Protocol (后续迭代)
    Ftp,
    /// Amazon S3 兼容存储 (后续迭代)
    S3,
    /// SCP - Secure Copy Protocol (后续迭代)
    Scp,
}

impl Protocol {
    /// 获取协议默认端口
    pub fn default_port(&self) -> u16 {
        match self {
            Protocol::Sftp => 22,
            Protocol::WebDav => 443,
            Protocol::Ftp => 21,
            Protocol::S3 => 443,
            Protocol::Scp => 22,
        }
    }

    /// 是否支持 TLS/SSL
    pub fn supports_tls(&self) -> bool {
        matches!(self, Protocol::Sftp | Protocol::WebDav | Protocol::Ftp | Protocol::S3)
    }
}


// src-tauri/src/enums/connection_status.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connecting,
    Connected,
    Disconnecting,
    Disconnected,
    Reconnecting,
    Error,
}


// src-tauri/src/enums/theme.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}


// src-tauri/src/enums/language.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Language {
    En,
    Zh,
}


// src-tauri/src/enums/sort_column.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum SortColumn {
    Name,
    Size,
    LastModified,
    Owner,
    Permissions,
}


// src-tauri/src/enums/sort_order.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum SortOrder {
    Ascending,
    Descending,
}


// src-tauri/src/enums/error_code.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    // 连接错误
    ConnectionFailed,
    AuthFailed,
    NotConnected,
    ConnectionTimeout,
    HostUnreachable,

    // 文件操作错误
    FileNotFound,
    PermissionDenied,
    FileAlreadyExists,
    DirectoryNotEmpty,

    // 协议错误
    ProtocolError,
    UnsupportedOperation,

    // 存储错误
    StorageReadFailed,
    StorageWriteFailed,

    // 加密错误
    CryptoDecryptFailed,
    CryptoEncryptFailed,

    // 会话错误
    SessionNotFound,
    SessionExpired,

    // 操作错误
    OperationCancelled,
    OperationTimeout,

    // 平台错误
    PlatformUnsupported,
}


// src-tauri/src/enums/file_operation.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum FileOperation {
    Download,
    Upload,
    Delete,
    Move,
    Rename,
    CreateDirectory,
    CreateFile,
    Transfer,
}


// src-tauri/src/enums/edit_mode.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum EditMode {
    External,
    Online,
}


// src-tauri/src/enums/platform.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Windows,
    Macos,
    Linux,
    Ios,
    Android,
}

impl Platform {
    pub fn is_mobile(&self) -> bool {
        matches!(self, Platform::Ios | Platform::Android)
    }

    pub fn is_desktop(&self) -> bool {
        !self.is_mobile()
    }
}


// src-tauri/src/enums/transfer_direction.rs
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum TransferDirection {
    LocalToRemote,
    RemoteToLocal,
    RemoteToRemote,
}
```

---

## 5. 模块划分

### 5.1 Rust 后端模块

```
src-tauri/
├── src/
│   ├── main.rs                     # Tauri 应用入口
│   ├── lib.rs                      # 模块注册
│   │
│   ├── enums/                      # ★ 全局枚举目录（唯一真理源）
│   │   ├── mod.rs
│   │   ├── protocol.rs
│   │   ├── connection_status.rs
│   │   ├── theme.rs
│   │   ├── language.rs
│   │   ├── sort_column.rs
│   │   ├── sort_order.rs
│   │   ├── error_code.rs
│   │   ├── file_operation.rs
│   │   ├── edit_mode.rs
│   │   ├── platform.rs
│   │   ├── transfer_direction.rs
│   │   └── adapter_capability.rs
│   │
│   ├── transport/                  # ★ FileTransport 协议抽象层
│   │   ├── mod.rs                  # trait 定义 + adapter 工厂
│   │   ├── sftp_adapter.rs         # SFTP adapter (russh)
│   │   ├── webdav_adapter.rs       # WebDAV adapter (reqwest)
│   │   ├── progress.rs             # ProgressEvent 定义
│   │   └── # 后续:
│   │       # ftp_adapter.rs       # FTP adapter (suppaftp)
│   │       # s3_adapter.rs         # S3 adapter
│   │
│   ├── commands/                   # Tauri 命令层（对前端暴露）
│   │   ├── mod.rs
│   │   ├── connection.rs           # 连接管理命令
│   │   ├── file_ops.rs             # 文件操作命令
│   │   ├── editor.rs               # 远程编辑命令
│   │   ├── settings.rs             # 设置命令
│   │   └── transfer.rs             # 跨主机传输命令
│   │
│   ├── core/                       # 核心业务逻辑
│   │   ├── mod.rs
│   │   ├── session_manager.rs      # 会话管理器（依赖 FileTransport trait）
│   │   └── file_watcher.rs         # 文件监听服务
│   │
│   ├── crypto/                     # 加密模块
│   │   ├── mod.rs
│   │   ├── secret_protector.rs     # AES-256-GCM 加解密
│   │   └── key_storage.rs          # 平台密钥存储
│   │
│   ├── storage/                    # 持久化模块
│   │   ├── mod.rs
│   │   ├── settings.rs             # 配置文件读写
│   │   └── migration.rs            # 旧配置迁移
│   │
│   ├── models/                     # 数据模型
│   │   ├── mod.rs
│   │   ├── remote_host.rs          # RemoteHost（替代 FtpHost）
│   │   ├── remote_file.rs          # RemoteFile
│   │   ├── settings.rs             # AppSettings
│   │   ├── host_dto.rs             # HostDto
│   │   └── progress.rs             # 进度事件 Payload
│   │
│   └── error.rs                    # 统一错误类型
│
├── Cargo.toml
└── tauri.conf.json
```

### 5.2 React 前端模块

```
src/
├── main.tsx                        # React 入口
├── App.tsx                         # 根组件 + 路由
│
├── pages/                          # 页面级组件
│   ├── MainWindow.tsx              # 主界面
│   ├── Settings.tsx                # 设置页面
│   └── HostEdit.tsx                # 主机编辑页面
│
├── features/                       # 功能模块
│   ├── connection/                 # 连接管理
│   │   ├── ConnectionBar.tsx
│   │   ├── HostList.tsx
│   │   ├── HostCard.tsx
│   │   └── hooks.ts
│   ├── browser/                    # 文件浏览
│   │   ├── FileList.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── FileIcon.tsx
│   │   ├── SortHeader.tsx
│   │   └── hooks.ts
│   ├── file-ops/                   # 文件操作
│   │   ├── DownloadBar.tsx
│   │   ├── UploadZone.tsx
│   │   ├── ContextMenu.tsx
│   │   └── ConfirmDialog.tsx
│   ├── editor/                     # 远程编辑
│   │   ├── OnlineEditor.tsx
│   │   └── EditorToolbar.tsx
│   └── transfer/                   # 跨主机传输
│       ├── TransferDialog.tsx
│       └── TransferBrowser.tsx
│
├── components/                     # 通用组件
│   ├── ui/                         # shadcn/ui 组件
│   ├── layout/                     # 布局组件
│   │   ├── ResponsiveLayout.tsx
│   │   ├── MobileTabBar.tsx
│   │   └── DesktopSidebar.tsx
│   └── shared/                     # 共享组件
│
├── stores/                         # Zustand 状态
│   ├── connectionStore.ts
│   ├── browserStore.ts
│   └── settingsStore.ts
│
├── hooks/                          # 通用 Hooks
│   ├── useTauriCommand.ts
│   ├── useTauriEvent.ts
│   └── usePlatform.ts
│
├── lib/                            # 工具库
│   ├── tauri.ts                    # Tauri IPC 封装
│   ├── i18n.ts                     # 国际化配置
│   ├── fileIcons.ts                # 文件图标映射
│   └── utils.ts                    # 通用工具
│
├── types/
│   ├── enums/                      # ★ 全局枚举（ts-rs 自动生成）
│   │   ├── index.ts
│   │   ├── Protocol.ts
│   │   ├── ConnectionStatus.ts
│   │   ├── Theme.ts
│   │   ├── Language.ts
│   │   ├── SortColumn.ts
│   │   ├── SortOrder.ts
│   │   ├── ErrorCode.ts
│   │   ├── FileOperation.ts
│   │   ├── EditMode.ts
│   │   ├── Platform.ts
│   │   ├── TransferDirection.ts
│   │   └── AdapterCapability.ts
│   └── generated/                  # ts-rs 自动生成的结构体类型
│       ├── RemoteHost.ts
│       ├── RemoteFile.ts
│       ├── AppSettings.ts
│       └── ...
│
└── styles/
    └── globals.css                 # 全局样式
```

---

## 6. 会话管理架构

### 6.1 会话管理器设计

```rust
// src-tauri/src/core/session_manager.rs

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use std::time::Instant;

use crate::enums::Protocol;
use crate::models::{RemoteHost, RemoteFile};
use crate::transport::{FileTransport, create_adapter};

/// 全局唯一会话管理器
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<Uuid, Session>>>,
}

/// 单个连接会话
pub struct Session {
    pub host_id: Uuid,
    pub host: RemoteHost,
    pub transport: Box<dyn FileTransport>,
    pub current_path: String,
    pub created_at: Instant,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 连接主机
    pub async fn connect(
        &self,
        host: &RemoteHost,
        password: Option<&str>,
    ) -> Result<String, AppError> {
        // 通过 Protocol 枚举创建对应 adapter
        let mut transport = create_adapter(host.protocol);

        // 连接（adapter 内部处理协议细节）
        transport.connect(host, password).await?;

        let home_dir = transport.get_working_dir().await?;

        let session = Session {
            host_id: host.id,
            host: host.clone(),
            transport,
            current_path: home_dir.clone(),
            created_at: Instant::now(),
        };

        self.sessions.write().await.insert(host.id, session);
        Ok(home_dir)
    }

    /// 获取会话
    pub async fn get_session(&self, host_id: Uuid) -> Option<SessionRef> {
        // 返回只读引用
    }

    /// 断开连接
    pub async fn disconnect(&self, host_id: Uuid) -> Result<(), AppError> {
        if let Some(mut session) = self.sessions.write().await.remove(&host_id) {
            session.transport.disconnect().await?;
        }
        Ok(())
    }

    /// 列出目录（通过 trait 对象调度）
    pub async fn list_directory(
        &self,
        host_id: Uuid,
        path: &str,
    ) -> Result<Vec<RemoteFile>, AppError> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(&host_id)
            .ok_or(AppError::SessionNotFound(host_id.to_string()))?;
        session.transport.list_directory(path).await
    }

    // ... 其他代理方法，全部通过 transport trait 调用
}
```

### 6.2 跨协议传输

```rust
/// 跨主机/跨协议文件传输
/// 
/// 由于两个主机可能使用不同协议（如 SFTP → WebDAV），
/// 传输通过本地临时文件中转：
/// 1. 从源 adapter 下载到临时文件
/// 2. 从临时文件上传到目标 adapter
/// 3. 删除临时文件
pub async fn transfer_between_hosts(
    source: &dyn FileTransport,
    dest: &dyn FileTransfer,
    source_path: &str,
    dest_path: &str,
    progress: ProgressTx,
) -> Result<(), AppError> {
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(Uuid::new_v4().to_string());

    // 1. 下载到临时文件
    source.download_file(source_path, temp_file.to_str().unwrap(), progress.clone()).await?;

    // 2. 上传到目标
    dest.upload_file(temp_file.to_str().unwrap(), dest_path, progress).await?;

    // 3. 清理
    tokio::fs::remove_file(&temp_file).await.ok();

    Ok(())
}
```

---

## 7. 数据流架构

### 7.1 命令调用流（前端 → 后端）

```
React Component
    │
    ▼
TanStack Query (useQuery / useMutation)
    │
    ▼
lib/tauri.ts (封装 invoke)
    │
    ▼  Tauri IPC (JSON-RPC)
    │
    ▼
Rust Command (#[tauri::command])
    │
    ▼
SessionManager (会话查找)
    │
    ▼
Box<dyn FileTransport> (trait 对象调度)
    │
    ▼
具体 Adapter (SftpAdapter / WebDavAdapter)
    │
    ▼
协议库 (russh / reqwest)
    │
    ▼
Remote Server
```

### 7.2 事件推送流（后端 → 前端）

```
Rust Core (异步任务完成 / 文件变更 / 连接断开)
    │
    ▼
app.emit("event-name", payload)
    │
    ▼  Tauri Event Bus
    │
    ▼
React Hook (useTauriEvent)
    │
    ▼
Zustand Store (状态更新)
    │
    ▼
React Component (自动重渲染)
```

### 7.3 关键数据流场景

#### 场景 1：连接主机

```
用户点击"连接"
    → connect_host(host_id) → Rust: SessionManager.connect()
    → Rust: create_adapter(host.protocol)  // 工厂创建 adapter
    → Rust: adapter.connect(host, password) // adapter 内部处理协议
    → Rust: emit("connection:status", { host_id, status: Connecting })
    → Rust: adapter.get_working_dir() → home_dir
    → Rust: emit("connection:connected", { host_id, home_dir })
    → 前端: connectionStore 更新状态
    → 前端: list_directory(host_id, home_dir)
    → Rust: SessionManager → adapter.list_directory()
    → 前端: browserStore 更新文件列表
```

#### 场景 2：跨协议传输（SFTP → WebDAV）

```
用户选择"传输到"→ 选择目标 WebDAV 主机
    → transfer_file(source_host_id, source_path, dest_host_id, dest_path)
    → Rust: 获取两个会话的 adapter (Box<dyn FileTransfer>)
    → Rust: transfer_between_hosts(source_adapter, dest_adapter, ...)
    →   1. SftpAdapter.download_file() → 临时文件
    →   2. WebDavAdapter.upload_file() → 从临时文件上传
    →   3. 清理临时文件
    → Rust: emit("transfer:progress", {...})
    → Rust: emit("transfer:done", {...})
    → 前端: 刷新目标主机文件列表
```

---

## 8. 安全架构

### 8.1 密码加密流程

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Input │────►│  SecretProtector  │────►│  Encrypted JSON │
│  (plaintext)│     │  (AES-256-GCM)   │     │  (enc.v1:...)   │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   Key Storage     │
                    ├──────────────────┤
                    │ Windows: DPAPI    │
                    │ macOS: Keychain   │
                    │ Linux: file 0600  │
                    │ iOS: Keychain     │
                    │ Android: Keystore │
                    └──────────────────┘
```

### 8.2 密钥存储策略

| 平台 | 方案 | 说明 |
|------|------|------|
| Windows | DPAPI (CurrentUser) | 使用 `keyring` crate |
| macOS | Keychain | 使用 `keyring` crate |
| Linux | 文件 `~/.local/share/sy-tfm/key.bin` (0600) | 首次生成随机 32 字节 |
| iOS | iOS Keychain (kSecAttrAccessibleWhenUnlocked) | Tauri iOS 原生支持 |
| Android | Android Keystore | 使用 KeyStore API |

---

## 9. 跨平台适配策略

### 9.1 UI 适配

```javascript
// Tailwind 响应式断点
screens: {
  'mobile': '0px',      // 手机
  'tablet': '768px',    // 平板
  'desktop': '1024px',  // 桌面
}
```

| 组件 | 桌面端 | 移动端 |
|------|--------|--------|
| 导航 | 左侧固定侧栏 | 底部 Tab + 抽屉 |
| 文件列表 | DataGrid 表格 | Card 列表 + 滑动操作 |
| 右键菜单 | Context Menu | Long-press Bottom Sheet |
| 拖拽 | dnd-kit 拖放 | 不支持（用"移动"按钮替代） |
| 面包屑 | 完整路径 + 溢出折叠 | 简化路径（仅当前目录名） |
| 编辑器 | 全屏 + 工具栏 | 半屏 + 虚拟键盘适配 |

### 9.2 文件系统适配

```rust
// 下载路径解析
fn resolve_download_dir(host: &RemoteHost, settings: &AppSettings) -> String {
    // 1. 主机配置的下载路径
    if let Some(path) = &host.download_path {
        return path.clone();
    }
    // 2. 全局默认下载路径
    if let Some(path) = &settings.default_download_path {
        return path.clone();
    }
    // 3. 平台默认下载路径
    platform_default_download_dir()
}

fn platform_default_download_dir() -> String {
    #[cfg(target_os = "android")]
    return "/storage/emulated/0/Download/SY-TFM";

    #[cfg(target_os = "ios")]
    return app_documents_dir(); // NSDocumentDirectory

    #[cfg(desktop)]
    return dirs::download_dir()
        .unwrap_or(dirs::home_dir().unwrap())
        .join("SY-TFM")
        .to_string_lossy()
        .to_string();
}
```

---

## 10. 错误处理架构

### 10.1 Rust 错误层级

```rust
// src-tauri/src/error.rs

use crate::enums::ErrorCode;

/// 应用级错误：统一前端可见错误
#[derive(Debug, thiserror::Error, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

// 便捷构造
impl AppError {
    pub fn not_connected() -> Self {
        Self::new(ErrorCode::NotConnected, "Not connected to host")
    }

    pub fn session_not_found(id: impl std::fmt::Display) -> Self {
        Self::new(ErrorCode::SessionNotFound, format!("Session not found: {}", id))
    }

    pub fn connection_failed(msg: impl Into<String>) -> Self {
        Self::new(ErrorCode::ConnectionFailed, msg)
    }

    pub fn protocol_error(msg: impl Into<String>) -> Self {
        Self::new(ErrorCode::ProtocolError, msg)
    }
}

// Tauri command 自动将 Result<T, AppError> 序列化为 JSON
```

### 10.2 前端错误处理

```typescript
// lib/tauri.ts
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { AppError } from '../types/generated/AppError';
import { ErrorCode } from '../types/enums';

async function invoke<T>(cmd: string, args?: object): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (err) {
    const appError = err as AppError;
    // 根据错误码决定处理策略
    switch (appError.code) {
      case ErrorCode.NotConnected:
        toast.error(appError.message);
        break;
      case ErrorCode.OperationCancelled:
        // 静默处理
        break;
      default:
        toast.error(appError.message);
    }
    throw appError;
  }
}
```

---

## 11. 代码规范

### 11.1 前端代码规范

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 11.2 Rust 代码规范

- 使用 `cargo fmt` 格式化
- 使用 `cargo clippy` 静态检查
- 所有 `pub` 项必须有文档注释
- 错误使用 `thiserror` 派生，禁止 `unwrap()` 在非测试代码
- 枚举必须 `#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]`

---

## 12. 构建与部署

### 12.1 目录结构

```
sy-tfm/
├── src/                    # React 前端源码
├── src-tauri/              # Rust 后端源码
│   ├── src/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/              # 应用图标
│   ├── gen/                # Tauri 生成的平台代码
│   │   ├── android/        # Android 项目
│   │   └── apple/          # iOS 项目
│   └── capabilities/       # Tauri 2 权限配置
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── README.md
```

### 12.2 构建命令

```bash
# 开发模式（前端包管理器统一使用 bun，不使用 npm）
bun run tauri dev

# 桌面端构建
bun run tauri build          # 当前平台
bun run tauri build -- --target aarch64-apple-darwin  # 交叉编译

# 移动端
bun run tauri android init   # 初始化 Android 项目
bun run tauri android dev    # Android 开发调试
bun run tauri android build  # Android APK/AAB

bun run tauri ios init       # 初始化 iOS 项目
bun run tauri ios dev        # iOS 开发调试
bun run tauri ios build      # iOS IPA

# 类型同步（Rust → TypeScript）
cargo test --test export_types

# 代码检查
bun lint                     # eslint
bun format                   # prettier
cargo clippy                 # rust lint

# 阶段性质量门禁（强制）：每完成一个阶段性功能须运行
bun lint && bun format && bun test
```

### 12.3 CI/CD

- GitHub Actions 矩阵构建：Windows / macOS / Linux / Android / iOS
- 自动生成 Release 草稿，附带各平台安装包
- 语义化版本标签触发发布流程
