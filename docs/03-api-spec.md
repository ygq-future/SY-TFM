# SY-TFM — 接口规范文档

**项目名称:** SY-TFM (Tiny File Manager)  
**日期:** 2026-07-05  
**状态:** Draft  

---

## 1. 接口概览

所有接口通过 Tauri 2 IPC 机制暴露，前端使用 `@tauri-apps/api` 的 `invoke()` 调用。

### 1.1 命名规范

- 命令名：`snake_case`（Rust 惯例）
- 参数名：`camelCase`（前端惯例，Tauri 自动转换）
- 事件名：`namespace:action`（如 `connection:connected`）
- 枚举值：由全局 `enums/` 目录定义，前端通过 ts-rs 生成的类型引用

### 1.2 通用响应格式

```typescript
// 成功：直接返回数据
type Success<T> = T;

// 失败：Tauri 自动将 Rust Error 序列化为
interface AppError {
  code: ErrorCode;      // 枚举错误码
  message: string;      // 人类可读消息
  details?: unknown;    // 可选附加信息
}
```

### 1.3 协议无关性

所有文件操作接口**不感知具体协议**。前端传入 `hostId`，后端通过 `SessionManager` 查找对应会话，通过 `Box<dyn FileTransport>` trait 对象调度到具体 adapter（SftpAdapter / WebDavAdapter）。

### 1.4 分页与进度

- 列表接口不分页（远程协议不支持高效分页）
- 长操作（下载/上传）通过事件推送进度

---

## 2. 连接管理接口

### 2.1 connect_host

连接到远程主机。

```typescript
invoke('connect_host', {
  hostId: string,       // 主机 UUID
  password?: string,    // 临时密码（未保存密码时前端弹出对话框获取）
})
```

**返回值：**
```typescript
{
  hostId: string;
  homeDir: string;      // 用户主目录路径
  protocol: Protocol;   // 实际使用的协议
  capabilities: AdapterCapability;  // adapter 能力声明
}
```

**事件：**
| 事件 | 时机 | Payload |
|------|------|---------|
| `connection:status` | 连接状态变化 | `ConnectionStatusPayload` |

---

### 2.2 disconnect_host

断开主机连接。

```typescript
invoke('disconnect_host', {
  hostId: string,
})
```

**返回值：** `void`

---

### 2.3 get_connection_status

查询主机连接状态。

```typescript
invoke('get_connection_status', {
  hostId: string,
})
```

**返回值：**
```typescript
{
  hostId: string;
  status: ConnectionStatus;
  isConnected: boolean;
  currentPath: string | null;
  sessionAge: number | null;  // 会话存活秒数
  protocol: Protocol | null;
}
```

---

### 2.4 get_connected_hosts

获取所有已连接的主机列表。

```typescript
invoke('get_connected_hosts')
```

**返回值：**
```typescript
Array<{
  hostId: string;
  hostName: string;
  currentPath: string;
  protocol: Protocol;
  capabilities: AdapterCapability;
}>
```

---

### 2.5 get_adapter_capabilities

查询指定主机 adapter 支持的能力（用于 UI 动态适配）。

```typescript
invoke('get_adapter_capabilities', {
  hostId: string,
})
```

**返回值：**
```typescript
{
  protocol: Protocol;
  capabilities: AdapterCapability;  // 位标志
  supportedColumns: SortColumn[];   // 支持的排序列
  supportsOwner: boolean;
  supportsPermissions: boolean;
  supportsSymlinks: boolean;
}
```

---

### 2.6 ensure_session

确保主机有活跃会话（用于跨主机传输面板）。若已有会话则返回现有，否则新建。

```typescript
invoke('ensure_session', {
  hostId: string,
  password?: string,
})
```

**返回值：**
```typescript
{
  hostId: string;
  homeDir: string;
  protocol: Protocol;
}
```

---

### 2.7 release_session

释放会话（用于跨主机传输面板关闭时）。

```typescript
invoke('release_session', {
  hostId: string,
})
```

**返回值：** `void`

---

## 3. 文件浏览接口

### 3.1 list_directory

列出远程目录内容。

```typescript
invoke('list_directory', {
  hostId: string,
  path: string,         // 目录路径，如 "/var/log"
})
```

**返回值：**
```typescript
Array<{
  name: string;
  fullPath: string;
  size: number;          // 字节数，目录为 0
  isDirectory: boolean;
  lastModified: string;  // ISO 8601 时间戳
  owner: string | null;         // "owner:group"，WebDAV 可能返回 null
  permissions: string | null;   // "rwxr-xr-x"，WebDAV 可能返回 null
  isParentEntry: boolean;       // 是否为 ".." 条目
}>
```

> **注意：** `owner` 和 `permissions` 字段根据 adapter 能力可能为 `null`。前端应根据 `get_adapter_capabilities` 的返回值决定是否显示这些列。

---

### 3.2 change_directory

切换当前工作目录。

```typescript
invoke('change_directory', {
  hostId: string,
  path: string,
})
```

**返回值：**
```typescript
{
  currentPath: string;   // 实际路径（服务器可能规范化）
}
```

---

### 3.3 get_working_directory

获取当前工作目录。

```typescript
invoke('get_working_directory', {
  hostId: string,
})
```

**返回值：** `string`

---

### 3.4 navigate_to_path

切换目录并列表（原子操作，减少一次往返）。

```typescript
invoke('navigate_to_path', {
  hostId: string,
  path: string,
})
```

**返回值：**
```typescript
{
  currentPath: string;
  files: RemoteFile[];   // 同 list_directory 返回
}
```

---

### 3.5 file_exists

检查文件/目录是否存在。

```typescript
invoke('file_exists', {
  hostId: string,
  path: string,
})
```

**返回值：** `boolean`

---

### 3.6 get_file_size

获取文件大小。

```typescript
invoke('get_file_size', {
  hostId: string,
  path: string,
})
```

**返回值：** `number`（字节）

---

## 4. 文件操作接口

### 4.1 download_file

下载单个文件。

```typescript
invoke('download_file', {
  hostId: string,
  remotePath: string,
  localPath: string,     // 本地保存路径
})
```

**返回值：** `void`

**事件：**
| 事件 | Payload |
|------|---------|
| `download:progress` | `ProgressPayload` |
| `download:done` | `{ hostId: string, remotePath: string, localPath: string }` |
| `download:error` | `{ hostId: string, remotePath: string, code: ErrorCode, message: string }` |

---

### 4.2 download_directory

递归下载目录。

```typescript
invoke('download_directory', {
  hostId: string,
  remotePath: string,
  localPath: string,
})
```

**返回值：** `void`

**事件：** 同 `download_file`，额外包含：
| 事件 | Payload |
|------|---------|
| `download:directory_progress` | `{ hostId: string, currentFile: string, fileIndex: number, totalFiles: number }` |

---

### 4.3 download_files

批量下载多文件/目录。

```typescript
invoke('download_files', {
  hostId: string,
  items: Array<{ path: string; isDirectory: boolean }>,
  localDir: string,
})
```

**返回值：** `void`

**事件：**
| 事件 | Payload |
|------|---------|
| `download:batch_progress` | `BatchProgressPayload` |

---

### 4.4 upload_file

上传单个文件。

```typescript
invoke('upload_file', {
  hostId: string,
  localPath: string,
  remotePath: string,
})
```

**返回值：** `void`

**事件：**
| 事件 | Payload |
|------|---------|
| `upload:progress` | `ProgressPayload` |
| `upload:done` | `{ hostId: string, remotePath: string }` |
| `upload:error` | `{ hostId: string, remotePath: string, code: ErrorCode, message: string }` |

---

### 4.5 upload_directory

递归上传目录。

```typescript
invoke('upload_directory', {
  hostId: string,
  localPath: string,
  remotePath: string,
})
```

**返回值：** `void`

---

### 4.6 upload_files

批量上传文件/目录（拖拽上传用）。

```typescript
invoke('upload_files', {
  hostId: string,
  localPaths: string[],  // 本地文件/文件夹路径数组
  remoteDir: string,     // 远程目标目录
})
```

**返回值：** `void`

---

### 4.7 delete_file

删除文件。

```typescript
invoke('delete_file', {
  hostId: string,
  path: string,
})
```

**返回值：** `void`

---

### 4.8 delete_directory

删除目录（递归）。

```typescript
invoke('delete_directory', {
  hostId: string,
  path: string,
})
```

**返回值：** `void`

---

### 4.9 create_directory

创建目录。

```typescript
invoke('create_directory', {
  hostId: string,
  path: string,
})
```

**返回值：** `void`

---

### 4.10 create_file

创建空文件（通过上传空临时文件实现）。

```typescript
invoke('create_file', {
  hostId: string,
  path: string,
})
```

**返回值：** `void`

---

### 4.11 move_file

移动/重命名文件或目录。

```typescript
invoke('move_file', {
  hostId: string,
  fromPath: string,
  toPath: string,
})
```

**返回值：** `void`

---

### 4.12 rename_file

重命名（同目录下 move 的快捷方式）。

```typescript
invoke('rename_file', {
  hostId: string,
  path: string,
  newName: string,
})
```

**返回值：** `void`

---

### 4.13 cancel_operation

取消正在进行的下载/上传操作。

```typescript
invoke('cancel_operation', {
  operationId: string,   // 操作 ID（从 progress 事件获取）
})
```

**返回值：** `void`

---

## 5. 跨主机传输接口

### 5.1 transfer_file

在两个主机间传输文件（支持跨协议，如 SFTP → WebDAV）。

```typescript
invoke('transfer_file', {
  sourceHostId: string,
  sourcePath: string,
  destHostId: string,
  destPath: string,
})
```

**返回值：** `void`

**事件：**
| 事件 | Payload |
|------|---------|
| `transfer:progress` | `{ sourceHostId: string, destHostId: string, sourcePath: string, transferred: number, total: number, percent: number }` |
| `transfer:done` | `{ sourceHostId: string, destHostId: string, sourcePath: string, destPath: string }` |
| `transfer:error` | `{ sourceHostId: string, destHostId: string, code: ErrorCode, message: string }` |

> **实现说明：** 跨协议传输通过本地临时文件中转：先从源 adapter 下载到临时文件，再从临时文件上传到目标 adapter。

---

### 5.2 transfer_files

批量跨主机传输。

```typescript
invoke('transfer_files', {
  sourceHostId: string,
  destHostId: string,
  items: Array<{ path: string; isDirectory: boolean }>,
  destDir: string,
})
```

**返回值：** `void`

---

## 6. 远程编辑接口

### 6.1 edit_remote_external

使用外部编辑器编辑远程文件（桌面端）。

```typescript
invoke('edit_remote_external', {
  hostId: string,
  filePath: string,
})
```

**返回值：**
```typescript
{
  tempPath: string;     // 本地临时文件路径
  editSessionId: string; // 编辑会话 ID
}
```

**事件：**
| 事件 | Payload |
|------|---------|
| `editor:synced` | `{ hostId: string, filePath: string, syncTime: string }` |
| `editor:error` | `{ hostId: string, filePath: string, code: ErrorCode, message: string }` |
| `editor:session_invalid` | `{ editSessionId: string }` |

---

### 6.2 edit_remote_online

下载文件内容供内置编辑器编辑（在线编辑模式）。

```typescript
invoke('edit_remote_online', {
  hostId: string,
  filePath: string,
})
```

**返回值：**
```typescript
{
  content: string;      // 文件文本内容
  encoding: string;     // "utf-8" | "binary"
  size: number;
  language: string;     // 检测到的语言 "rust" | "python" | "json" | ...
}
```

---

### 6.3 save_remote_online

保存内置编辑器内容到远程。

```typescript
invoke('save_remote_online', {
  hostId: string,
  filePath: string,
  content: string,
})
```

**返回值：** `void`

---

### 6.4 stop_edit_sessions

停止所有编辑会话（断开连接时调用）。

```typescript
invoke('stop_edit_sessions', {
  hostId: string,
})
```

**返回值：** `void`

---

## 7. 设置管理接口

### 7.1 get_settings

读取应用配置。

```typescript
invoke('get_settings')
```

**返回值：** `AppSettings`（见数据模型文档）

---

### 7.2 save_settings

保存应用配置。

```typescript
invoke('save_settings', {
  settings: AppSettings,
})
```

**返回值：** `void`

---

### 7.3 update_setting

更新单个配置项（局部更新，避免全量覆盖）。

```typescript
invoke('update_setting', {
  key: string,          // 配置键，如 "theme" / "accentColor"
  value: unknown,       // 配置值
})
```

**返回值：** `void`

---

### 7.4 get_download_dir

解析下载目录（三级优先级）。

```typescript
invoke('get_download_dir', {
  hostId?: string,      // 可选，指定主机
})
```

**返回值：** `string`

---

### 7.5 export_config

导出配置（不含加密密码）。

```typescript
invoke('export_config')
```

**返回值：**
```typescript
{
  content: string;      // JSON 字符串
  filename: string;     // 建议文件名 "sy-tfm-config-export.json"
}
```

---

### 7.6 import_config

导入配置。

```typescript
invoke('import_config', {
  content: string,      // JSON 字符串
})
```

**返回值：**
```typescript
{
  imported: number;     // 导入的主机数量
  skipped: number;      // 跳过的数量（重复）
}
```

---

## 8. 主机管理接口

### 8.1 get_hosts

获取所有主机配置。

```typescript
invoke('get_hosts')
```

**返回值：** `Array<RemoteHost>`

---

### 8.2 save_host

保存主机（新建或更新）。

```typescript
invoke('save_host', {
  host: RemoteHost,
})
```

**返回值：** `string`（主机 ID）

---

### 8.3 delete_host

删除主机。

```typescript
invoke('delete_host', {
  hostId: string,
})
```

**返回值：** `void`

---

### 8.4 clone_host

克隆主机配置。

```typescript
invoke('clone_host', {
  hostId: string,
  newName: string,
})
```

**返回值：** `string`（新主机 ID）

---

### 8.5 get_supported_protocols

获取当前应用支持的协议列表（用于主机编辑界面动态渲染协议选项）。

```typescript
invoke('get_supported_protocols')
```

**返回值：**
```typescript
Array<{
  protocol: Protocol;
  label: string;        // 显示名称 "SFTP" / "WebDAV"
  defaultPort: number;  // 默认端口
  supportsTls: boolean; // 是否支持 TLS
  isAvailable: boolean; // 当前版本是否已实现
}>
```

---

## 9. 平台接口

### 9.1 get_platform_info

获取平台信息。

```typescript
invoke('get_platform_info')
```

**返回值：**
```typescript
{
  platform: Platform;   // 枚举值
  arch: "x86_64" | "aarch64" | "armv7";
  version: string;
  isMobile: boolean;
  appVersion: string;
}
```

---

### 9.2 open_in_explorer

在系统文件管理器中打开（桌面端）。

```typescript
invoke('open_in_explorer', {
  path: string,
})
```

**返回值：** `void`

---

### 9.3 open_external_editor

用系统默认程序打开文件（桌面端）。

```typescript
invoke('open_external_editor', {
  path: string,
})
```

**返回值：** `void`

---

### 9.4 pick_folder

原生文件夹选择器。

```typescript
invoke('pick_folder', {
  title?: string,
})
```

**返回值：** `string | null`（选中的文件夹路径）

---

### 9.5 pick_files

原生文件选择器。

```typescript
invoke('pick_files', {
  multiple?: boolean,
  filters?: Array<{ name: string; extensions: string[] }>,
})
```

**返回值：** `string[]`（选中的文件路径数组）

---

### 9.6 share_file

分享文件（移动端）。

```typescript
invoke('share_file', {
  path: string,
  mimeType?: string,
})
```

**返回值：** `void`

---

## 10. 事件系统总览

### 10.1 事件注册方式

```typescript
import { listen } from '@tauri-apps/api/event';

// React Hook 封装
function useTauriEvent<T>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    const unlisten = listen<T>(event, (e) => handler(e.payload));
    return () => { unlisten.then(fn => fn()); };
  }, [event, handler]);
}
```

### 10.2 事件清单

| 事件名 | 方向 | Payload 类型 | 说明 |
|--------|------|-------------|------|
| `connection:status` | 后端→前端 | `ConnectionStatusPayload` | 连接状态变化 |
| `connection:disconnected` | 后端→前端 | `{ hostId: string, reason: string }` | 意外断连 |
| `download:progress` | 后端→前端 | `ProgressPayload` | 下载进度 |
| `download:done` | 后端→前端 | `{ hostId, remotePath, localPath }` | 下载完成 |
| `download:error` | 后端→前端 | `{ hostId, remotePath, code, message }` | 下载错误 |
| `download:batch_progress` | 后端→前端 | `BatchProgressPayload` | 批量下载进度 |
| `upload:progress` | 后端→前端 | `ProgressPayload` | 上传进度 |
| `upload:done` | 后端→前端 | `{ hostId, remotePath }` | 上传完成 |
| `upload:error` | 后端→前端 | `{ hostId, remotePath, code, message }` | 上传错误 |
| `transfer:progress` | 后端→前端 | `TransferProgressPayload` | 跨主机传输进度 |
| `transfer:done` | 后端→前端 | `{ sourceHostId, destHostId, sourcePath, destPath }` | 传输完成 |
| `transfer:error` | 后端→前端 | `{ sourceHostId, destHostId, code, message }` | 传输错误 |
| `editor:synced` | 后端→前端 | `{ hostId, filePath, syncTime }` | 文件已同步回远程 |
| `editor:error` | 后端→前端 | `{ hostId, filePath, code, message }` | 编辑同步错误 |
| `editor:session_invalid` | 后端→前端 | `{ editSessionId }` | 编辑会话失效 |
| `settings:changed` | 后端→前端 | `AppSettings` | 配置文件变更 |

### 10.3 事件 Payload 类型定义

```typescript
// ConnectionStatusPayload
interface ConnectionStatusPayload {
  hostId: string;
  status: ConnectionStatus;  // 枚举
  message?: string;
}

// ProgressPayload
interface ProgressPayload {
  hostId: string;
  operationId: string;
  transferred: number;
  total: number;
  percent: number;
  speed: number;         // bytes/sec
  currentFile: string;
}

// BatchProgressPayload
interface BatchProgressPayload {
  hostId: string;
  operationId: string;
  currentIndex: number;
  totalCount: number;
  currentFile: string;
  filePercent: number;
}
```

---

## 11. 错误码定义

所有错误码定义在 `ErrorCode` 枚举中（见架构文档 `enums/error_code.rs`），前端通过 ts-rs 生成的 `ErrorCode` 枚举引用。

| 枚举值 | 序列化值 | 说明 | 前端处理建议 |
|--------|---------|------|-------------|
| `ConnectionFailed` | `"connection_failed"` | 连接失败 | 显示错误，检查地址端口 |
| `AuthFailed` | `"auth_failed"` | 认证失败 | 提示检查用户名密码 |
| `NotConnected` | `"not_connected"` | 未连接即操作 | 自动尝试重连 |
| `ConnectionTimeout` | `"connection_timeout"` | 连接超时 | 重试或检查网络 |
| `HostUnreachable` | `"host_unreachable"` | 主机不可达 | 检查网络/防火墙 |
| `FileNotFound` | `"file_not_found"` | 文件不存在 | 刷新列表 |
| `PermissionDenied` | `"permission_denied"` | 权限不足 | 显示权限错误 |
| `FileAlreadyExists` | `"file_already_exists"` | 文件已存在 | 提示覆盖或跳过 |
| `DirectoryNotEmpty` | `"directory_not_empty"` | 目录非空 | 确认递归删除 |
| `ProtocolError` | `"protocol_error"` | 协议错误 | 显示原始错误 |
| `UnsupportedOperation` | `"unsupported_operation"` | 不支持的操作 | 隐藏对应功能 |
| `StorageReadFailed` | `"storage_read_failed"` | 配置读取失败 | 回退默认配置 |
| `StorageWriteFailed` | `"storage_write_failed"` | 配置写入失败 | 提示检查磁盘空间 |
| `CryptoDecryptFailed` | `"crypto_decrypt_failed"` | 解密失败 | 提示重新输入密码 |
| `CryptoEncryptFailed` | `"crypto_encrypt_failed"` | 加密失败 | 提示检查密钥存储 |
| `SessionNotFound` | `"session_not_found"` | 会话不存在 | 刷新连接状态 |
| `SessionExpired` | `"session_expired"` | 会话过期 | 重新连接 |
| `OperationCancelled` | `"operation_cancelled"` | 操作被取消 | 静默处理 |
| `OperationTimeout` | `"operation_timeout"` | 操作超时 | 重试 |
| `PlatformUnsupported` | `"platform_unsupported"` | 平台不支持 | 隐藏对应功能 |
