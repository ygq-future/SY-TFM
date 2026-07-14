# SY-TFM — 需求文档

**项目名称:** SY-TFM (Tiny File Manager)  
**日期:** 2026-07-05  
**状态:** Draft  

---

## 1. 项目概述

### 1.1 背景

SY-TFM 是一个跨平台、轻量级远程文件管理器。"SY" 为个人前缀，"TFM" 代表 Tiny File Manager。项目基于 **Tauri 2 + React + Rust** 技术栈，原生支持 **Windows / macOS / Linux / iOS / Android** 五端。

与传统的单一协议 FTP 客户端不同，SY-TFM 从架构层面将**文件传输协议抽象为可插拔的 Adapter 模式**——SFTP、WebDAV、FTP 等协议各自实现统一的 `FileTransport` trait，新增协议只需添加一个 adapter，无需修改上层业务代码。

### 1.2 目标

| 目标 | 描述 |
|------|------|
| 协议可扩展 | FileTransport Adapter 架构，首版支持 SFTP + WebDAV，后续零成本扩展 |
| 全平台覆盖 | Windows / macOS / Linux / iOS / Android 五端原生运行 |
| 体积优化 | 安装包 < 15 MB（桌面），< 25 MB（移动） |
| 性能提升 | 冷启动 < 2s，目录列表 < 500ms（千文件） |
| 安全增强 | 密码 AES-256-GCM 加密，移动端使用平台 Keystore |
| 架构规范 | 所有常量收敛至全局枚举目录，零魔法字符串 |

### 1.3 非目标

- 不支持 Web 端（浏览器访问）
- 首版不实现 FTP/FTPS adapter（后续迭代）
- 不内置终端模拟器
- 不支持 P2P 文件传输

---

## 2. 目标用户

| 用户画像 | 核心诉求 |
|----------|----------|
| 后端开发者 | 快速连接服务器查看日志、编辑配置文件 |
| 运维工程师 | 移动端应急查看文件、修改配置 |
| NAS / 网盘用户 | 通过 WebDAV 管理私有云存储 |
| 前端/全栈开发者 | 上传静态资源、管理部署目录 |
| 学生/学习者 | 免费轻量工具替代付费 GUI 客户端 |

---

## 3. 架构需求

### 3.1 FileTransport Adapter 架构 (ARCH-01)

**这是 SY-TFM 的核心架构需求，所有协议交互必须通过统一的 FileTransport trait。**

#### ARCH-01-01: 协议抽象层

- 定义统一的 `FileTransport` trait，涵盖所有远程文件操作（连接、浏览、上传、下载、删除、移动、重命名、创建目录/文件）
- 每个 protocol adapter 独立实现该 trait
- 上层代码（SessionManager、Commands）只依赖 trait，不感知具体协议
- 新增协议 = 新增一个 adapter 文件 + 在 Protocol 枚举中注册，零修改上层

#### ARCH-01-02: Adapter 注册机制

- 通过 Protocol 枚举驱动 adapter 工厂函数
- adapter 创建通过 `create_adapter(protocol: Protocol) -> Box<dyn FileTransport>`
- 首版实现两个 adapter：
  - `SftpAdapter` — 基于 russh，支持 SFTP 协议
  - `WebDavAdapter` — 基于 reqwest，支持 WebDAV 协议
- 后续计划（不在首版范围）：
  - `FtpAdapter` — 基于 suppaftp，支持 FTP/FTPS
  - `S3Adapter` — 支持 Amazon S3 兼容存储
  - `ScpAdapter` — 基于 russh，支持 SCP

#### ARCH-01-03: 协议能力声明

- 每个 adapter 声明自身支持的能力（capability flags）
- 例如：WebDAV 不一定支持 owner/permissions 信息，SFTP 不支持隐式 TLS
- 上层根据能力声明调整 UI 展示和操作选项

### 3.2 全局枚举管理 (ARCH-02)

#### ARCH-02-01: 枚举目录

- 所有常量、状态码、类型标识符**必须**定义为枚举，禁止散落的魔法字符串
- Rust 后端设有全局枚举目录 `src-tauri/src/enums/`，按领域分文件
- TypeScript 前端设有对应的 `src/types/enums/` 目录，由 ts-rs 自动生成
- 枚举定义是全项目唯一的真理源（single source of truth）

#### ARCH-02-02: 必需枚举清单

| 枚举 | 用途 |
|------|------|
| `Protocol` | 协议类型（Sftp, WebDav, Ftp, S3, ...） |
| `ConnectionStatus` | 连接状态（Connecting, Connected, Disconnected, ...） |
| `Theme` | 主题（Light, Dark, System） |
| `Language` | 语言（En, Zh） |
| `SortColumn` | 排序列（Name, Size, LastModified, Owner, Permissions） |
| `SortOrder` | 排序方向（Ascending, Descending） |
| `ErrorCode` | 错误码 |
| `FileOperation` | 文件操作类型（Download, Upload, Delete, Move, ...） |
| `EditMode` | 编辑模式（External, Online） |
| `Platform` | 运行平台（Windows, Macos, Linux, Ios, Android） |
| `TransferDirection` | 传输方向（LocalToRemote, RemoteToLocal, RemoteToRemote） |
| `AdapterCapability` | Adapter 能力声明标志位 |

---

## 4. 功能需求

### 4.1 连接管理 (CONN)

#### CONN-01: 主机 CRUD

- 用户可创建、编辑、删除、克隆主机配置
- 每个主机包含：名称、协议类型、地址、端口、用户名、密码、标签、下载路径
- 协议类型由用户显式选择（SFTP / WebDAV），不再通过端口推断
- 协议选择后自动填充默认端口（SFTP=22，WebDAV=443/80）
- 支持匿名连接（用户名 `anonymous`）

#### CONN-02: 连接与断开

- 用户可连接/断开任意主机
- 多主机可同时保持连接，各自独立会话
- 侧栏显示每个主机的连接状态指示器（圆点 + 协议图标）
- 连接前若主机未保存密码，弹出密码输入对话框
  - 支持"记住密码"选项：勾选则持久化，不勾选则仅本次有效
  - 取消输入显示"连接已取消"，不报错

#### CONN-03: 连接稳定性

- 启用 TCP KeepAlive，检测断连
- 操作前自动检查连接状态，断连时自动重连（最多 3 次，指数退避）
- 重连失败显示明确错误信息

#### CONN-04: 密码安全

- 所有密码使用 AES-256-GCM 加密存储
- **桌面端**：密钥文件 Windows 用 DPAPI 包裹，macOS/Linux 用 `chmod 0600`
- **移动端**：密钥存储至 iOS Keychain / Android Keystore
- 旧版明文密码（无 `enc.v1:` 前缀）加载后自动升级加密

#### CONN-05: 跨主机传输

- 用户可在 A 主机浏览时，打开"传输到"面板选择 B 主机
- 支持**跨协议传输**（如 SFTP → WebDAV），通过 adapter 抽象层实现
- 面板独立管理连接状态，支持连接/断开/刷新
- 传输前校验源端和目标端连接均有效
- 支持文件和目录的跨主机复制

### 4.2 文件浏览 (BROWSE)

#### BROWSE-01: 目录列表

- 显示文件名、大小、修改时间
- 所有者、权限列按 adapter 能力声明条件显示（SFTP 支持，WebDAV 可能不支持）
- 目录排在文件前，".." 父目录条目固定在顶部（非根目录时）
- 支持按名称/大小/修改时间/所有者/权限排序，升降序切换
- 列表加载时显示 loading 指示器

#### BROWSE-02: 面包屑路径栏

- 按路径层级显示可点击的面包屑
- 路径过长时中间折叠为"…"，点击展开 flyout 显示完整路径
- 双击空白处进入路径编辑模式，手动输入路径跳转
- 提供复制路径按钮，点击后显示 toast 提示

#### BROWSE-03: 文件图标

- 150+ 文件类型映射到彩色矢量图标
- 按文件扩展名匹配（.py → Python 图标，.rs → Rust 图标等）
- 特殊文件名识别（Dockerfile、Makefile、README、package.json 等）
- 目录使用统一文件夹图标

#### BROWSE-04: 文件选择

- 单击选中文件
- **桌面端**：Ctrl+Click 多选，Shift+Click 范围选择，橡皮筋框选
- **移动端**：长按进入多选模式，再次点击追加选择
- 选中文件后高亮显示

### 4.3 文件操作 (FILE)

#### FILE-01: 下载

- 单文件/多文件下载
- 目录递归下载（保持目录结构）
- 下载目标解析优先级：主机配置 → 全局设置 → 系统默认
- 桌面端支持"下载到..."选择目标目录
- 下载进度条显示百分比和文件名
- 多文件下载显示整体进度（当前文件序号/总数）

#### FILE-02: 上传

- **桌面端**：拖拽文件/文件夹到文件列表触发上传
  - 自动检测拖入的是文件夹还是文件
  - 文件夹递归上传（自动创建远程目录）
- **移动端**：通过"上传"按钮选择文件
- 上传进度显示

#### FILE-03: 新建

- 新建文件：输入文件名，上传空临时文件到远程
- 新建文件夹：输入名称，远程创建目录
- 名称输入对话框含输入校验（非法字符检测）

#### FILE-04: 删除

- 单文件/多文件删除
- 删除前弹出确认对话框，显示文件名或数量
- 文件和目录分别调用对应删除接口
- 删除后自动刷新列表

#### FILE-05: 重命名

- 右键菜单/长按菜单触发
- 输入对话框预填当前名称，光标定位到末尾
- 通过 MOVE 命令实现（同目录下重命名）

#### FILE-06: 移动

- **桌面端**：拖拽文件到目标文件夹或".."条目触发移动
- 支持批量移动（多选后拖拽）
- 移动后自动刷新列表

### 4.4 远程编辑 (EDIT)

#### EDIT-01: 外部编辑器模式 (Remote Edit)

- 下载文件到本地临时目录（唯一文件名 `name_uuid.ext`）
- 使用系统默认程序打开文件
- 监听文件变更，自动回传到远程服务器
- 回传后刷新文件列表，显示最后同步时间
- 断开连接时使所有活跃的文件监听器失效
- 重连后旧监听器回调显示错误而非尝试上传

#### EDIT-02: 内置编辑器模式 (Online Edit)

- 内嵌代码编辑器，支持语法高亮
- 自动检测语言（按文件扩展名）
- 支持亮色/暗色主题
- 自动换行，避免长行水平滚动
- 保存时上传到远程服务器
- **移动端**：虚拟键盘适配，工具栏可滚动

### 4.5 设置 (SETT)

#### SETT-01: 通用设置

- 语言切换（英文 / 中文），实时生效
- 默认下载路径
- 默认数据路径（配置文件存储位置）

#### SETT-02: 外观设置

- 主题切换（亮色 / 暗色 / 跟随系统）
- 强调色选择（18 种预设 + 自定义 HEX）
- 背景图片（桌面端）：浏览选择图片 + 不透明度滑块（10%-100%）

#### SETT-03: 关于

- 显示应用名称、版本号、描述
- 开发者信息、许可证
- GitHub 仓库链接

#### SETT-04: 配置管理

- 所有配置统一存储在单一 `settings.json`
- 遗留配置（theme.json / accent.json / config.json）自动迁移
- 配置备份与恢复（桌面端）
- 配置导出为不含机器密钥的 HostDto 格式

### 4.6 国际化 (I18N)

- 支持英文、简体中文双语
- 语言切换实时生效，无需重启
- 所有 UI 文本、错误消息、状态提示均支持本地化
- 可扩展第三方语言包

---

## 5. 移动端特有需求 (MOBILE)

### 5.1 响应式布局

| 断点 | 宽度 | 布局 |
|------|------|------|
| mobile | < 768px | 单列，侧栏抽屉化，底部 Tab 导航 |
| tablet | 768-1024px | 双列，侧栏可折叠 |
| desktop | > 1024px | 三列，侧栏 + 文件列表 + 详情面板 |

### 5.2 触摸交互

- **滑动操作**：列表项左滑显示删除，右滑显示更多操作
- **长按**：进入多选模式 / 显示上下文菜单
- **双指缩放**：文件列表字体大小调整
- **下拉刷新**：刷新当前目录
- **Haptic 反馈**：删除确认、连接成功等关键操作触发振动反馈

### 5.3 移动端文件系统

- **iOS**：下载文件到 App Documents 目录，可通过 Files app 访问
- **Android**：下载文件到公共 Downloads 目录，使用 SAF (Storage Access Framework) 选择目标
- 上传文件通过系统文件选择器（支持 iCloud / Google Drive 等云存储）

### 5.4 移动端连接管理

- 应用进入后台后保持连接（最多 30 秒），超时自动断开
- 网络切换（Wi-Fi ↔ 蜂窝）时提示用户并尝试重连
- 移动数据下默认警告大文件传输

### 5.5 移动端编辑器

- 虚拟键盘弹出时自动调整编辑器高度
- 底部工具栏：保存、撤销、重做、查找
- 支持外接键盘快捷键（iPad / Android 平板）

---

## 6. 非功能需求

### 6.1 性能

| 指标 | 目标 |
|------|------|
| 冷启动时间 | < 2s（桌面），< 3s（移动） |
| 目录列表（1000 文件） | < 500ms |
| 文件下载（10MB） | < 5s（取决于网络） |
| 内存占用 | < 150MB（桌面），< 100MB（移动） |
| 安装包体积 | < 15MB（桌面），< 25MB（移动） |

### 6.2 安全

- 密码 AES-256-GCM 加密，密钥平台原生保护
- SFTP 支持主机密钥验证
- WebDAV 支持 HTTPS（TLS），可选 Basic/Digest 认证
- 配置文件权限 0600（macOS/Linux）
- 不记录密码到日志

### 6.3 可靠性

- 所有网络操作支持取消（CancellationToken 等效）
- 断连自动重连（最多 3 次，指数退避）
- 文件操作失败显示明确错误，不崩溃
- 配置文件损坏时回退默认值，不丢失主机列表

### 6.4 可维护性

- 前后端类型安全（TypeScript + Rust serde 共享类型定义）
- 统一错误处理中间件
- 模块化架构，功能解耦
- **FileTransport Adapter 模式确保协议扩展零成本**
- **全局枚举目录消除魔法字符串**
- 完整的接口文档和数据模型文档

### 6.5 跨平台一致性

- Windows / macOS / Linux / iOS / Android 五端功能一致
- UI 主题统一，平台原生标题栏适配
- 键盘快捷键桌面端可用，移动端有等效触摸操作

---

## 7. 约束与假设

### 7.1 技术约束

- Tauri 2.x（最低 2.0.0）
- Rust edition 2021
- React 18 + TypeScript 5
- 前端构建工具 Vite 5
- 代码规范：ESLint + Prettier + prettier-plugin-tailwindcss

### 7.2 平台约束

- iOS 最低版本 14.0
- Android 最低版本 8.0（API 26）
- Windows 最低版本 10（1809）
- macOS 最低版本 11.0（Big Sur）
- Linux: 支持主流发行版（Ubuntu 20.04+, Fedora 35+）

### 7.3 假设

- 用户有基础的远程服务器知识（SFTP / WebDAV）
- 移动端用户主要通过 Wi-Fi 连接
- 远程编辑主要针对文本文件（非二进制）

---

## 8. 验收标准

### 8.1 架构验收

- [ ] FileTransport trait 定义完整，所有操作方法有文档
- [ ] SftpAdapter 完整实现 FileTransport trait
- [ ] WebDavAdapter 完整实现 FileTransport trait
- [ ] 新增 adapter 仅需实现 trait + 注册枚举，零修改上层代码
- [ ] 全局枚举目录建立，所有常量通过枚举引用，无魔法字符串
- [ ] 枚举类型 Rust→TypeScript 自动同步管线工作正常

### 8.2 功能验收

- [ ] 桌面端核心功能完整（连接、浏览、编辑、传输）
- [ ] 移动端覆盖核心功能（连接、浏览、编辑、下载）
- [ ] SFTP 协议连接、浏览、文件操作正常
- [ ] WebDAV 协议连接、浏览、文件操作正常
- [ ] 跨协议传输（SFTP ↔ WebDAV）正常
- [ ] 五平台均能正常构建和运行
- [ ] 密码加密在所有平台正常工作
- [ ] 国际化切换无遗漏

### 8.3 性能验收

- [ ] 冷启动达标
- [ ] 千文件列表加载达标
- [ ] 内存占用达标
- [ ] 安装包体积达标

### 8.4 兼容性验收

- [ ] 旧版 settings.json 配置可自动迁移
- [ ] 旧版加密密码可自动解密并升级
- [ ] 五平台 UI 适配正确无错位
