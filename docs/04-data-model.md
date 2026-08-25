# SY-TFM — 数据模型文档

**项目名称:** SY-TFM (Tiny File Manager)  
**日期:** 2026-07-05  
**状态:** Draft  

---

## 1. 模型概览

本文档定义 SY-TFM 的全部数据模型，包括：
- Rust 结构体定义（后端）
- TypeScript 类型定义（前端，由 `ts-rs` 自动生成）
- 全局枚举目录定义
- 配置文件 JSON Schema
- 数据迁移策略

---

## 2. 全局枚举目录

### 2.1 设计原则

- 所有常量、状态码、类型标识符**必须**定义为枚举
- 禁止在代码中直接使用魔法字符串
- 枚举定义是全项目唯一的真理源（single source of truth）
- Rust 枚举通过 `ts-rs` 自动生成 TypeScript 对应类型

### 2.2 枚举清单

| 枚举 | Rust 文件 | 说明 |
|------|-----------|------|
| `Protocol` | `enums/protocol.rs` | 协议类型 |
| `ConnectionStatus` | `enums/connection_status.rs` | 连接状态 |
| `Theme` | `enums/theme.rs` | 主题 |
| `Language` | `enums/language.rs` | 语言 |
| `SortColumn` | `enums/sort_column.rs` | 排序列 |
| `SortOrder` | `enums/sort_order.rs` | 排序方向 |
| `ErrorCode` | `enums/error_code.rs` | 错误码 |
| `FileOperation` | `enums/file_operation.rs` | 文件操作类型 |
| `EditMode` | `enums/edit_mode.rs` | 编辑模式 |
| `Platform` | `enums/platform.rs` | 运行平台 |
| `TransferDirection` | `enums/transfer_direction.rs` | 传输方向 |
| `AdapterCapability` | `enums/adapter_capability.rs` | Adapter 能力标志位 |

### 2.3 Protocol 枚举（核心）

```rust
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

    /// 是否在当前版本已实现
    pub fn is_available(&self) -> bool {
        matches!(self, Protocol::Sftp | Protocol::WebDav)
    }
}
```

**TypeScript 生成类型：**
```typescript
// src/types/enums/Protocol.ts
export type Protocol = "sftp" | "webdav" | "ftp" | "s3" | "scp";
```

### 2.4 其他枚举定义

```rust
// src-tauri/src/enums/connection_status.rs
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}


// src-tauri/src/enums/language.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum Language {
    En,
    Zh,
}


// src-tauri/src/enums/sort_column.rs
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum SortOrder {
    Ascending,
    Descending,
}


// src-tauri/src/enums/error_code.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    ConnectionFailed,
    AuthFailed,
    NotConnected,
    ConnectionTimeout,
    HostUnreachable,
    FileNotFound,
    PermissionDenied,
    FileAlreadyExists,
    DirectoryNotEmpty,
    ProtocolError,
    UnsupportedOperation,
    StorageReadFailed,
    StorageWriteFailed,
    CryptoDecryptFailed,
    CryptoEncryptFailed,
    SessionNotFound,
    SessionExpired,
    OperationCancelled,
    OperationTimeout,
    PlatformUnsupported,
}


// src-tauri/src/enums/file_operation.rs
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum EditMode {
    External,
    Online,
}


// src-tauri/src/enums/platform.rs
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


// src-tauri/src/enums/transfer_direction.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/enums/")]
#[serde(rename_all = "camelCase")]
pub enum TransferDirection {
    LocalToRemote,
    RemoteToLocal,
    RemoteToRemote,
}


// src-tauri/src/enums/adapter_capability.rs
use bitflags::bitflags;

bitflags! {
    /// Adapter 能力标志位
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
    #[ts(export, export_to = "../src/types/enums/")]
    pub struct AdapterCapability: u32 {
        const NONE = 0;
        const OWNER_PERMISSIONS = 1 << 0;
        const SYMLINKS = 1 << 1;
        const ATOMIC_RENAME = 1 << 2;
        const CHMOD = 1 << 3;
        const CHOWN = 1 << 4;
        const RANGE_TRANSFER = 1 << 5;
    }
}
```

---

## 3. 核心数据模型

### 3.1 FavoriteFolder（收藏文件夹）

收藏文件夹属于单个主机，用于从路径栏或移动端收藏入口直接导航到远程目录。收藏列表按首次加入顺序保存，同一远程路径最多出现一次。

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteFolder {
    pub name: String,
    pub path: String,
}
```

### 3.2 RemoteHost（主机配置）

替代旧版的 FtpHost，支持多种协议。

**Rust 定义：**

```rust
// src-tauri/src/models/remote_host.rs

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use ts_rs::TS;
use crate::enums::Protocol;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct RemoteHost {
    /// 唯一标识符
    pub id: Uuid,
    /// 显示名称
    pub name: String,
    /// 协议类型（用户显式选择，不再通过端口推断）
    #[serde(default = "default_protocol")]
    pub protocol: Protocol,
    /// SFTP 为 IP/域名；WebDAV 为认证 URL 中除协议外的地址与路径
    pub host: String,
    /// SFTP 端口；WebDAV 新配置固定为 0（兼容旧配置中的显式端口）
    #[serde(default)]
    pub port: u16,
    /// 用户名（默认 "anonymous"）
    #[serde(default = "default_username")]
    pub username: String,
    /// 加密后的密码（enc.v1: 前缀 + Base64）
    #[serde(default)]
    pub password: String,
    /// 标签（逗号分隔字符串，如 "prod,web,server1"）
    #[serde(default)]
    pub tags: String,
    /// 该主机独立维护的收藏文件夹列表
    #[serde(default)]
    pub favorite_folders: Vec<FavoriteFolder>,
    /// 每主机下载路径覆盖（null = 使用全局默认）
    #[serde(default)]
    pub download_path: Option<String>,
    /// WebDAV 专用：协议选择（true = HTTPS，false = HTTP）
    #[serde(default = "default_https")]
    pub https: bool,
    /// WebDAV 专用：可选基础路径，追加到认证 URL 之后
    #[serde(default)]
    pub base_path: Option<String>,
    /// 运行时连接状态（不持久化）
    #[serde(skip)]
    pub is_connected: bool,
}

fn default_protocol() -> Protocol { Protocol::Sftp }
fn default_username() -> String { "anonymous".to_string() }
fn default_https() -> bool { true }

impl RemoteHost {
    /// 解析标签为列表
    pub fn tag_list(&self) -> Vec<String> {
        if self.tags.trim().is_empty() {
            return vec![];
        }
        self.tags
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// 克隆（不含运行时状态，生成新 ID）
    pub fn clone_config(&self) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: self.name.clone(),
            protocol: self.protocol,
            host: self.host.clone(),
            port: self.port,
            username: self.username.clone(),
            password: self.password.clone(),
            tags: self.tags.clone(),
            favorite_folders: Vec::new(),
            download_path: self.download_path.clone(),
            https: self.https,
            base_path: self.base_path.clone(),
            is_connected: false,
        }
    }

    /// 获取有效端口（0 = 使用协议默认端口）
    pub fn effective_port(&self) -> u16 {
        if self.port == 0 {
            self.protocol.default_port()
        } else {
            self.port
        }
    }
}
```

**TypeScript 生成类型：**

```typescript
// src/types/generated/RemoteHost.ts
import type { Protocol } from '../enums/Protocol';

export interface RemoteHost {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  password: string;
  tags: string;
  downloadPath: string | null;
  https: boolean;
  basePath: string | null;
}
```

**JSON 示例 (settings.json)：**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Production SFTP",
  "protocol": "sftp",
  "host": "192.168.1.100",
  "port": 22,
  "username": "deploy",
  "password": "enc.v1:SGVsbG8gV29ybGQ...",
  "tags": "prod,web",
  "favoriteFolders": [{ "name": "deploy", "path": "/srv/deploy" }],
  "downloadPath": null,
  "https": true,
  "basePath": null
}
```

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Nextcloud WebDAV",
  "protocol": "webdav",
  "host": "dav.example.com/remote.php/dav",
  "port": 0,
  "username": "user",
  "password": "enc.v1:SGVsbG8gV29ybGQ...",
  "tags": "cloud,personal",
  "downloadPath": null,
  "https": true,
  "basePath": "/team/files"
}
```

---

### 3.3 RemoteFile（远程文件）

**Rust 定义：**

```rust
// src-tauri/src/models/remote_file.rs

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct RemoteFile {
    /// 文件名
    pub name: String,
    /// 完整路径
    pub full_path: String,
    /// 字节数（目录为 0）
    pub size: i64,
    /// 是否为目录
    pub is_directory: bool,
    /// 最后修改时间（ISO 8601）
    pub last_modified: String,
    /// 所有者信息 "owner:group"（WebDAV 可能返回 null）
    #[serde(default)]
    pub owner: Option<String>,
    /// 权限字符串 "rwxr-xr-x"（WebDAV 可能返回 null）
    #[serde(default)]
    pub permissions: Option<String>,
}

impl RemoteFile {
    /// 是否为 ".." 父目录条目
    pub fn is_parent_entry(&self) -> bool {
        self.name == ".."
    }

    /// 创建 ".." 父目录条目
    pub fn parent_entry(parent_path: String) -> Self {
        Self {
            name: "..".to_string(),
            full_path: parent_path,
            size: 0,
            is_directory: true,
            last_modified: String::new(),
            owner: None,
            permissions: None,
        }
    }
}
```

**TypeScript 生成类型：**

```typescript
export interface RemoteFile {
  name: string;
  fullPath: string;
  size: number;
  isDirectory: boolean;
  lastModified: string;
  owner: string | null;
  permissions: string | null;
}
```

---

### 3.4 AppSettings（应用配置）

**Rust 定义：**

```rust
// src-tauri/src/models/settings.rs

use crate::enums::{Theme, Language};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 主题
    #[serde(default = "default_theme")]
    pub theme: Theme,
    /// 强调色 HEX
    #[serde(default = "default_accent")]
    pub accent_color: String,
    /// 语言
    #[serde(default = "default_language")]
    pub language: Language,
    /// 默认下载路径（null = 使用平台默认）
    #[serde(default)]
    pub default_download_path: Option<String>,
    /// 默认数据路径（null = 使用平台默认）
    #[serde(default)]
    pub default_data_path: Option<String>,
    /// 主机列表
    #[serde(default)]
    pub hosts: Vec<RemoteHost>,
    /// 窗口置顶（桌面端）
    #[serde(default)]
    pub window_topmost: bool,
    /// 背景图片路径（桌面端）
    #[serde(default)]
    pub background_image_path: Option<String>,
    /// 是否启用已保存的背景图片
    #[serde(default = "default_background_enabled")]
    pub background_image_enabled: bool,
    /// 背景图片不透明度 (0.1 - 1.0)
    #[serde(default = "default_bg_opacity")]
    pub background_opacity: f64,
    /// 全局毛玻璃模糊半径（像素）
    #[serde(default = "default_glass_blur")]
    pub glass_blur: f64,
    /// 全局毛玻璃表面不透明度
    #[serde(default = "default_glass_opacity")]
    pub glass_opacity: f64,
    /// 正文与控件字号
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    /// 页面和弹窗标题字号
    #[serde(default = "default_heading_font_size")]
    pub heading_font_size: f64,
    /// 表单标签与表头字号
    #[serde(default = "default_label_font_size")]
    pub label_font_size: f64,
    /// 提示、说明与辅助信息字号
    #[serde(default = "default_caption_font_size")]
    pub caption_font_size: f64,
    /// 文件元数据、路径和状态栏字号
    #[serde(default = "default_data_font_size")]
    pub data_font_size: f64,
    /// 配置版本号（用于迁移）
    #[serde(default = "default_config_version")]
    pub config_version: u32,
}

fn default_theme() -> Theme { Theme::System }
fn default_accent() -> String { "#2296F5".to_string() }
fn default_language() -> Language { Language::En }
fn default_bg_opacity() -> f64 { 0.3 }
fn default_config_version() -> u32 { 3 }

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            accent_color: default_accent(),
            language: default_language(),
            default_download_path: None,
            default_data_path: None,
            hosts: vec![],
            window_topmost: false,
            background_image_path: None,
            background_image_enabled: true,
            background_opacity: default_bg_opacity(),
            glass_blur: 22.0,
            glass_opacity: 0.72,
            font_size: 13.0,
            heading_font_size: 15.0,
            label_font_size: 12.0,
            caption_font_size: 11.0,
            data_font_size: 12.0,
            config_version: default_config_version(),
        }
    }
}
```

**JSON 示例：**

```json
{
  "theme": "dark",
  "accentColor": "#2296F5",
  "language": "zh",
  "defaultDownloadPath": "/Users/foo/Downloads/SY-TFM",
  "defaultDataPath": null,
  "hosts": [ ... ],
  "windowTopmost": false,
  "backgroundImagePath": null,
  "backgroundImageEnabled": true,
  "backgroundOpacity": 0.3,
  "glassBlur": 22.0,
  "glassOpacity": 0.72,
  "fontSize": 13.0,
  "headingFontSize": 15.0,
  "labelFontSize": 12.0,
  "captionFontSize": 11.0,
  "dataFontSize": 12.0,
  "configVersion": 3
}
```

`backgroundImagePath` 在桌面端是用户选择的普通本地文件路径；Android Photo Picker 返回的 `content://` 只具有受限 URI 访问语义，选择后必须立即复制到应用私有 `files/backgrounds/selected-background-<sha256-prefix>.<ext>`，配置保存内容寻址后的路径而不是原始 URI。不同图片即使扩展名相同也必须产生不同路径，以触发 WebView 背景资源重载；旧内容在新文件原子落盘后清理，且不会要求全盘媒体权限。

---

### 3.5 HostDto（主机传输对象）

用于配置导入/导出，绕过机器特定加密。

```rust
// src-tauri/src/models/host_dto.rs

use crate::enums::Protocol;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct HostDto {
    pub name: String,
    pub protocol: Protocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    /// 导出时不包含密码
    #[serde(skip_serializing)]
    pub password: Option<String>,
    pub tags: String,
    #[serde(default)]
    pub favorite_folders: Vec<FavoriteFolder>,
    pub download_path: Option<String>,
    pub https: bool,
    pub base_path: Option<String>,
}

impl From<RemoteHost> for HostDto {
    fn from(h: RemoteHost) -> Self {
        Self {
            name: h.name,
            protocol: h.protocol,
            host: h.host,
            port: h.port,
            username: h.username,
            password: if h.password.is_empty() { None } else { Some("[PROTECTED]".to_string()) },
            tags: h.tags,
            favorite_folders: h.favorite_folders,
            download_path: h.download_path,
            https: h.https,
            base_path: h.base_path,
        }
    }
}
```

---

## 4. 传输层数据模型

### 4.1 Session（连接会话）

**Rust 定义（不序列化，仅内存）：**

```rust
// src-tauri/src/core/session_manager.rs

use std::time::Instant;
use std::sync::Arc;
use std::collections::HashMap;
use parking_lot::Mutex;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

use crate::transport::FileTransport;
use crate::models::RemoteHost;

pub struct Session {
    pub host_id: Uuid,
    pub host: RemoteHost,
    pub transport: Box<dyn FileTransport>,  // trait 对象
    pub current_path: String,
    pub created_at: Instant,
}

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<Uuid, Session>>>,
}
```

### 4.2 ProgressPayload（进度事件数据）

```rust
// src-tauri/src/models/progress.rs

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub host_id: Uuid,
    pub operation_id: String,
    pub transferred: u64,
    pub total: u64,
    pub percent: f64,
    pub speed: f64,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct BatchProgressPayload {
    pub host_id: Uuid,
    pub operation_id: String,
    pub current_index: usize,
    pub total_count: usize,
    pub current_file: String,
    pub file_percent: f64,
}
```

### 4.3 ConnectionStatusPayload

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatusPayload {
    pub host_id: Uuid,
    pub status: ConnectionStatus,
    pub message: Option<String>,
}
```

---

## 5. 文件监听数据模型

### 5.1 EditSession（编辑会话）

```rust
// src-tauri/src/core/file_watcher.rs

use std::path::PathBuf;
use uuid::Uuid;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::RwLock;
use std::collections::HashMap;

pub struct EditSession {
    pub host_id: Uuid,
    pub remote_path: String,
    pub file_name: String,
    pub local_path: PathBuf,
    pub valid: Arc<AtomicBool>,
    pub watcher: notify::RecommendedWatcher,
    lease: Option<std::fs::File>, // 持有会话目录 .lock 的跨进程独占锁
}

pub struct EditSessionManager {
    sessions: Mutex<HashMap<Uuid, EditSession>>, // key = edit_session_id
    start_guard: AsyncMutex<()>, // 串行化会话查重与创建
}
```

活动会话以 `(host_id, remote_path)` 作为复用键。系统编辑器窗口关闭不会终止 watcher；
只要主机连接仍有效且临时文件存在，后续 Remote Edit 会直接重新打开同一个本地文件。
临时路径采用 `%TEMP%/SY-TFM/<完整会话 UUID>/<源文件名>_<UUID 后 8 位>.<扩展名>`；
完整 UUID 目录负责绝对隔离，可见短后缀用于在系统编辑器中区分不同目录下的同名文件。
应用启动时会扫描 `%TEMP%/SY-TFM/<session-uuid>/`，只清理能够取得独占租约的失效会话；
其他 SY-TFM 实例仍持有锁的目录与非会话目录均会保留。

---

## 6. 加密数据模型

### 6.1 加密数据格式

```
enc.v1:<Base64(nonce || ciphertext || tag)>

字段说明:
  - nonce:      12 bytes (AES-GCM 标准随机数)
  - ciphertext: 明文长度(变长)
  - tag:        16 bytes (认证标签)
  - Base64:     标准 Base64 编码
```

### 6.2 密钥文件格式

| 平台 | 路径 | 格式 |
|------|------|------|
| Windows | `%LOCALAPPDATA%\SY-TFM\key.bin` | DPAPI 包裹的 32 字节 |
| macOS | `~/Library/Application Support/SY-TFM/key.bin` | 原始 32 字节 (0600) |
| Linux | `~/.local/share/sy-tfm/key.bin` | 原始 32 字节 (0600) |
| iOS | Keychain (kSecClassGenericPassword) | 原始 32 字节 |
| Android | Keystore (AndroidKeyStore) | 密钥不导出，通过 API 使用 |

### 6.3 Portable Vault v1

```json
{
  "format": "vault.v1",
  "vaultId": "uuid",
  "revision": 3,
  "updatedAt": "2026-07-18T12:00:00Z",
  "keyEnvelope": {
    "kdf": {
      "salt": "Base64",
      "memoryKib": 65536,
      "iterations": 3,
      "parallelism": 1
    },
    "nonce": "Base64",
    "ciphertext": "Base64 wrapped Vault Key"
  },
  "payloadNonce": "Base64",
  "payloadEncoding": "gzip",
  "ciphertext": "Base64 encrypted portable settings"
}
```

`keyEnvelope` 允许用户更换设备后用备份密码解锁同一个 Vault Key；载荷认证数据绑定 `vaultId + revision`，篡改 metadata 会导致解密失败。
本地 `VaultSyncSettings.password` 保存的是设备绑定 `enc.v1` WebDAV 密码，不会写入便携载荷。
本地便携导出的解密载荷包含完整 `AppSettings`，并可选附带 `{ fileName, dataBase64 }` 背景图片；恢复时图片会落盘到当前设备应用数据目录的 `backgrounds` 子目录。

新文档先 gzip 压缩明文载荷再加密；旧文档没有 `payloadEncoding` 时按未压缩载荷读取。WebDAV 云端文档沿用外层 `vault.v1` 加密信封，但其解密后的载荷使用 schema v3：

```json
{
  "schemaVersion": 3,
  "hosts": ["跨平台共享的 RemoteHost（含明文后再整体加密的密码）"],
  "platforms": [
    {
      "platform": "windows",
      "settings": "不含 hosts/vaultSync 的 Windows AppSettings",
      "hostSettings": [{ "hostId": "uuid", "downloadPath": "C:/Downloads/SY-TFM" }],
      "backgroundAsset": {
        "fileName": "wallpaper.png",
        "remoteFile": "background-windows-<sha256>.gz",
        "sha256": "hex",
        "uncompressedSize": 8388608
      }
    },
    {
      "platform": "android",
      "settings": "不含 hosts/vaultSync 的 Android AppSettings",
      "hostSettings": [{ "hostId": "uuid", "downloadPath": "/storage/.../SY-TFM" }],
      "backgroundAsset": {
        "fileName": "selected-background.jpg",
        "remoteFile": "background-android-<sha256>.gz",
        "sha256": "hex",
        "uncompressedSize": 6291456
      }
    }
  ]
}
```

同步时当前平台只替换自己的 `platforms` 条目并更新共享 `hosts`，其他平台条目原样保留。每主机 `downloadPath` 也保存在当前平台的 `hostSettings`，不会进入共享主机。平台背景的本地绝对路径不写入云端，只保存资源索引；实际字节位于同一 `/SY-TFM` 目录下的 `background-windows-<sha256>.gz`、`background-android-<sha256>.gz` 等内容寻址平台文件。新资源先上传，配置提交成功后才清理旧资源，因此正常状态每个平台只有一个压缩包，失败重试期间可能暂时保留新旧两个。恢复时先验证解压上限、原始大小和 SHA-256，再写入当前设备 `backgrounds` 目录。不存在当前平台条目则采用当前平台默认设置，只恢复主机连接数据。旧 schema v1 没有平台标识，迁移时仅保留可证明共享的主机；schema v2 的 `{ fileName, dataBase64 }` 会在下一次同步迁移为独立资源。
`VaultSyncSettings.backupPassword` 是便携导出与 WebDAV 共用的备份密码，只以当前设备 `enc.v1` 密文保存在 `settings.json`，不会进入便携载荷。`lastSyncedHostsHash` 与 `lastSyncedPlatformHash` 分别缓存共享主机和当前平台条目的 SHA-256 指纹；`lastSyncedScopeHash` 保留组合指纹，供旧配置迁移和完整作用域校验。`lastSyncedHostsSnapshot` 保存由当前设备主密钥再次加密的上次共享主机快照，仅用于逐 UUID 三方合并，不得以明文落盘或上传云端。这些检查点不包含其他平台条目；`enabled=false` 表示暂停而非解绑，其余同步字段必须原样保留。

收藏夹随共享 `hosts` 一起同步，因此 Windows 和 Android 看到同一主机的同一份收藏列表；旧配置缺少 `favoriteFolders` 字段时按空列表处理。

同步先下载并解密云端文档。共享主机按稳定 UUID 与加密的上次快照执行三方合并：不同 UUID 的两端新增取并集；某端未修改的记录接受另一端更新或删除；删除与同一记录的并发编辑以删除优先，防止离线设备复活已删除主机；同一 UUID 的不兼容并发新增/编辑仍返回明确冲突。主机顺序在只有一端变化时采用变化端，两端都变化时以云端现有顺序为基准追加本地独有项。当前平台条目继续按独立指纹三方判断，因此两个不同作用域可在同一轮中双向合并。内容相同则不上传、不增加 revision。旧设备在第一次主机写入前若哈希仍匹配，会先生成加密快照；无法确认基线时采用保守冲突策略。

---

## 7. 配置文件 Schema

### 7.1 settings.json JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AppSettings",
  "type": "object",
  "properties": {
    "theme": {
      "type": "string",
      "enum": ["light", "dark", "system"],
      "default": "system"
    },
    "accentColor": {
      "type": "string",
      "pattern": "^#[0-9A-Fa-f]{6}$",
      "default": "#2296F5"
    },
    "language": {
      "type": "string",
      "enum": ["en", "zh"],
      "default": "en"
    },
    "defaultDownloadPath": {
      "type": ["string", "null"]
    },
    "defaultDataPath": {
      "type": ["string", "null"]
    },
    "hosts": {
      "type": "array",
      "items": { "$ref": "#/definitions/RemoteHost" },
      "default": []
    },
    "windowTopmost": {
      "type": "boolean",
      "default": false
    },
    "backgroundImagePath": {
      "type": ["string", "null"]
    },
    "backgroundOpacity": {
      "type": "number",
      "minimum": 0.1,
      "maximum": 1.0,
      "default": 0.3
    },
    "configVersion": {
      "type": "integer",
      "default": 3
    }
  },
  "definitions": {
    "RemoteHost": {
      "type": "object",
      "required": ["id", "name", "protocol", "host", "port"],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "name": { "type": "string" },
        "protocol": {
          "type": "string",
          "enum": ["sftp", "webdav", "ftp", "s3", "scp"]
        },
        "host": { "type": "string" },
        "port": { "type": "integer", "minimum": 1, "maximum": 65535 },
        "username": { "type": "string", "default": "anonymous" },
        "password": { "type": "string", "default": "" },
        "tags": { "type": "string", "default": "" },
        "favoriteFolders": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "path"],
            "properties": {
              "name": { "type": "string" },
              "path": { "type": "string" }
            }
          },
          "default": []
        },
        "downloadPath": { "type": ["string", "null"] },
        "https": { "type": "boolean", "default": true },
        "basePath": { "type": ["string", "null"] }
      }
    }
  }
}
```

---

## 8. 数据迁移策略

### 8.1 迁移版本对照

| configVersion | 说明 | 迁移动作 |
|---------------|------|----------|
| 1 | 旧版 SY-FTP (.NET/Avalonia) 配置 | 见下方迁移步骤 |
| 2 | 中间版本 (FtpHost 无 protocol 字段) | 添加 protocol 字段 |
| 3 (当前) | SY-TFM 配置格式 (RemoteHost + protocol) | 无需迁移 |

### 8.2 从 v1 迁移到 v3

```rust
pub fn migrate_v1_to_v3(old_path: &Path, new_path: &Path) -> Result<AppSettings> {
    let v1: serde_json::Value = serde_json::from_str(&fs::read_to_string(old_path)?)?;

    // 1. 迁移基础字段
    let mut hosts = v1.get("hosts").cloned().unwrap_or(json!([]));
    if let Some(hosts_array) = hosts.as_array_mut() {
        for host in hosts_array {
            // 2. 旧版通过端口推断协议，新版显式设置 protocol 字段
            let port = host.get("port").and_then(|p| p.as_u64()).unwrap_or(22);
            let protocol = if port == 22 { "sftp" } else { "ftp" };
            host.as_object_mut().unwrap().insert(
                "protocol".to_string(),
                json!(protocol),
            );

            // 3. 添加 WebDAV 相关默认字段
            host.as_object_mut().unwrap().insert(
                "https".to_string(),
                json!(true),
            );
            host.as_object_mut().unwrap().insert(
                "basePath".to_string(),
                json!(null),
            );
        }
    }

    let v3 = serde_json::json!({
        "theme": v1.get("theme").cloned().unwrap_or(json!("system")),
        "accentColor": v1.get("accentColor").cloned().unwrap_or(json!("#2296F5")),
        "language": v1.get("language").cloned().unwrap_or(json!("en")),
        "defaultDownloadPath": v1.get("defaultDownloadPath").cloned().unwrap_or(json!(null)),
        "defaultDataPath": v1.get("defaultDataPath").cloned().unwrap_or(json!(null)),
        "hosts": hosts,
        "windowTopmost": v1.get("windowTopmost").cloned().unwrap_or(json!(false)),
        "backgroundImagePath": v1.get("backgroundImagePath").cloned().unwrap_or(json!(null)),
        "backgroundOpacity": v1.get("backgroundOpacity").cloned().unwrap_or(json!(0.3)),
        "configVersion": 3,
    });

    fs::write(new_path, serde_json::to_string_pretty(&v3)?)?;
    fs::rename(old_path, format!("{}.backup", old_path.display()))?;

    Ok(serde_json::from_value(v3)?)
}
```

### 8.3 迁移触发时机

```rust
impl SettingsService {
    pub fn load() -> Result<AppSettings> {
        let path = settings_file_path();

        if !path.exists() {
            if let Some(old_path) = find_legacy_config() {
                return migrate_v1_to_v3(&old_path, &path);
            }
            return Ok(AppSettings::default());
        }

        let mut settings: AppSettings = serde_json::from_str(&fs::read_to_string(&path)?)?;

        if settings.config_version < 3 {
            settings = migrate_v1_to_v3(&path, &path)?;
        }

        Ok(settings)
    }

    fn find_legacy_config() -> Option<PathBuf> {
        let candidates = vec![
            // SY-FTP 旧路径
            dirs::data_local_dir()?.join("SY-FTP").join("settings.json"),
            dirs::config_dir()?.join("SY-FTP").join("settings.json"),
            dirs::data_local_dir()?.join("sy-ftp").join("settings.json"),
            // SY-TFM 新路径
            dirs::data_local_dir()?.join("SY-TFM").join("settings.json"),
        ];
        candidates.into_iter().find(|p| p.exists())
    }
}
```

---

## 9. 前端状态模型

### 9.1 Zustand Store 定义

```typescript
// stores/connectionStore.ts
import type { RemoteHost } from '../types/generated/RemoteHost';
import type { ConnectionStatus } from '../types/enums/ConnectionStatus';
import type { Protocol } from '../types/enums/Protocol';
import type { AdapterCapability } from '../types/enums/AdapterCapability';

interface ConnectionStore {
  hosts: RemoteHost[];
  connectedHostIds: Set<string>;
  selectedHostId: string | null;
  connectionStatus: Record<string, ConnectionStatus>;
  hostCapabilities: Record<string, AdapterCapability>;

  selectHost: (id: string | null) => void;
  connectHost: (id: string, password?: string) => Promise<void>;
  disconnectHost: (id: string) => Promise<void>;
  addHost: (host: RemoteHost) => Promise<void>;
  updateHost: (host: RemoteHost) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;
  cloneHost: (id: string, newName: string) => Promise<void>;
}

// stores/browserStore.ts
import type { RemoteFile } from '../types/generated/RemoteFile';
import type { SortColumn } from '../types/enums/SortColumn';
import type { SortOrder } from '../types/enums/SortOrder';
import type { AdapterCapability } from '../types/enums/AdapterCapability';

interface BrowserStore {
  files: RemoteFile[];
  currentPath: string;
  isLoading: boolean;
  errorMessage: string;
  selectedFiles: RemoteFile[];
  sortColumn: SortColumn;
  sortOrder: SortOrder;
  isEditingPath: boolean;
  editPathText: string;

  // 下载状态
  isDownloading: boolean;
  downloadProgress: number;
  downloadStatusText: string;

  // adapter 能力（决定显示哪些列）
  capabilities: AdapterCapability | null;

  loadDirectory: (hostId: string, path: string) => Promise<void>;
  navigateToPath: (hostId: string, path: string) => Promise<void>;
  refresh: (hostId: string) => Promise<void>;
  toggleSort: (column: SortColumn) => void;
  selectFile: (file: RemoteFile | null) => void;
  selectFiles: (files: RemoteFile[]) => void;
  downloadSelected: (hostId: string) => Promise<void>;
  deleteSelected: (hostId: string) => Promise<void>;
  renameFile: (hostId: string, file: RemoteFile, newName: string) => Promise<void>;
  createDirectory: (hostId: string, name: string) => Promise<void>;
  createFile: (hostId: string, name: string) => Promise<void>;
  moveFiles: (hostId: string, sources: RemoteFile[], targetPath: string) => Promise<void>;
}

// stores/settingsStore.ts
import type { AppSettings } from '../types/generated/AppSettings';
import type { Theme } from '../types/enums/Theme';
import type { Language } from '../types/enums/Language';

interface SettingsStore {
  settings: AppSettings;
  isDarkMode: boolean;
  accentColor: string;
  language: Language;

  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setAccentColor: (hex: string) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  setBackgroundImage: (path: string | null, opacity: number) => Promise<void>;
}
```

---

## 10. 国际化数据模型

### 10.1 翻译文件结构

```json
// src/locales/en.json
{
  "connection": {
    "status": {
      "connecting": "Connecting...",
      "connected": "Connected to {{name}}",
      "disconnected": "Disconnected",
      "error": "Error: {{message}}",
      "cancelled": "Connection cancelled"
    }
  },
  "protocol": {
    "sftp": "SFTP",
    "webdav": "WebDAV",
    "ftp": "FTP",
    "s3": "S3",
    "scp": "SCP"
  },
  "file": {
    "column": {
      "name": "Name",
      "size": "Size",
      "modified": "Modified",
      "owner": "Owner",
      "permissions": "Permissions"
    },
    "items": "{{count}} items",
    "synced": "Synced at {{time}}"
  },
  "download": {
    "single": "Downloading {{name}}...",
    "single.pct": "Downloading {{name}}... {{percent}}%",
    "multi.label": "{{name}} ({{index}}/{{total}})",
    "done.single": "{{name}} downloaded",
    "done.multi": "{{count}} files downloaded",
    "choose_folder": "Choose download folder"
  },
  "confirm": {
    "delete": {
      "title": "Confirm Delete",
      "single": "Are you sure you want to delete \"{{name}}\"?",
      "multi": "Are you sure you want to delete {{count}} items?",
      "btn": "Delete"
    }
  },
  "settings": {
    "section": {
      "general": "General",
      "appearance": "Appearance",
      "paths": "Paths",
      "about": "About"
    }
  }
}
```

```json
// src/locales/zh.json
{
  "connection": {
    "status": {
      "connecting": "连接中...",
      "connected": "已连接到 {{name}}",
      "disconnected": "未连接",
      "error": "错误：{{message}}",
      "cancelled": "连接已取消"
    }
  },
  "protocol": {
    "sftp": "SFTP",
    "webdav": "WebDAV",
    "ftp": "FTP",
    "s3": "S3",
    "scp": "SCP"
  },
  "file": {
    "column": {
      "name": "名称",
      "size": "大小",
      "modified": "修改时间",
      "owner": "所有者",
      "permissions": "权限"
    },
    "items": "{{count}} 个项目",
    "synced": "同步于 {{time}}"
  }
}
```

---

## 11. 文件图标映射模型

### 11.1 图标映射表

```typescript
// lib/fileIcons.ts

interface IconMapping {
  extension: string;
  icon: string;        // Lucide icon name
  color: string;       // HEX color
}

// 150+ 文件类型映射（部分示例）
const ICON_MAP: Record<string, IconMapping> = {
  // 编程语言
  '.rs':   { icon: 'Flame',          color: '#CE422B' },
  '.py':   { icon: 'FileCode',       color: '#3776AB' },
  '.js':   { icon: 'FileCode',       color: '#F7DF1E' },
  '.ts':   { icon: 'FileCode',       color: '#3178C6' },
  '.tsx':  { icon: 'FileCode',       color: '#3178C6' },
  '.go':   { icon: 'FileCode',       color: '#00ADD8' },
  '.java': { icon: 'Coffee',         color: '#ED8B00' },
  '.c':    { icon: 'FileCode',       color: '#A8B9CC' },
  '.cpp':  { icon: 'FileCode',       color: '#00599C' },
  '.cs':   { icon: 'FileCode',       color: '#239120' },

  // 配置文件
  '.json': { icon: 'Braces',         color: '#F7DF1E' },
  '.yaml': { icon: 'FileText',       color: '#CB171E' },
  '.yml':  { icon: 'FileText',       color: '#CB171E' },
  '.toml': { icon: 'FileText',       color: '#9C4121' },
  '.xml':  { icon: 'FileCode',       color: '#0060AC' },
  '.env':  { icon: 'Settings',       color: '#ECD53F' },

  // 标记语言
  '.md':   { icon: 'FileText',       color: '#083FA1' },
  '.html': { icon: 'FileCode',       color: '#E34F26' },
  '.css':  { icon: 'FileCode',       color: '#1572B6' },

  // 特殊文件名
  'Dockerfile':    { icon: 'Container', color: '#2496ED' },
  'Makefile':      { icon: 'Wrench',    color: '#427819' },
  'README':        { icon: 'BookOpen',  color: '#083FA1' },
  'package.json':  { icon: 'Package',   color: '#CB3837' },
  '.gitignore':    { icon: 'GitBranch', color: '#F05032' },
};

export function getFileIcon(filename: string, isDirectory: boolean): IconMapping {
  if (isDirectory) return { icon: 'Folder', color: '#54AEFF' };

  const baseName = filename.split('/').pop() || filename;
  if (ICON_MAP[baseName]) return ICON_MAP[baseName];

  const ext = '.' + (filename.split('.').pop() || '');
  return ICON_MAP[ext] || { icon: 'File', color: '#6B7280' };
}
```
