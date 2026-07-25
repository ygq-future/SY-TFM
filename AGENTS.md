# AGENTS.md — SY-TFM 开发约束文档

> **用途**：本文件是面向 AI 编码代理（以及所有贡献者）的**权威约束文档**。
> 它规定本项目不可违背的架构铁律、命名规范、安全约束与代码规范。
> 详细设计请查阅 `docs/` 目录（需求 `01-requirements.md`、架构 `02-architecture.md`、
> 接口 `03-api-spec.md`、数据模型 `04-data-model.md`、实现计划 `05-implementation-plan.md`、进度日志 `06-progress-log.md`）。
>
> **默认规则**：当本文件与任何实现细节产生冲突时，以本文件与 `docs/` 的架构决策（ADR-001~022）为准；如遇歧义，先确认再动手，不要擅自偏离架构。

---

## 1. 项目身份

| 项 | 值 |
|----|----|
| 项目名称 | SY-TFM — Tiny File Manager（"SY" 为个人前缀） |
| 技术栈 | **Tauri 2 + React 19 + Rust**（前端 Web，后端 Rust） |
| 覆盖平台 | Windows / macOS / Linux / iOS / Android（五端原生） |
| 定位 | 跨平台、轻量级远程文件管理器（安装包 < 15MB 桌面 / < 25MB 移动） |
| 核心架构 | 文件传输协议抽象为**可插拔 Adapter 模式**（FileTransport trait） |
| 首版协议 | **仅 SFTP（russh）+ WebDAV（reqwest + quick-xml）** |

旧版 `.NET/Avalonia` 实现位于 `sy-ftp-old-src/`，**仅作参考，禁止直接移植代码**。
所有逻辑须用 Rust 重写，前端由 XAML 迁移到 React。

---

## 2. 绝对架构约束（HARD CONSTRAINTS）

### 2.1 FileTransport Adapter 模式（ARCH-01，最高优先级）

- `FileTransport` trait（`src-tauri/src/transport/mod.rs`）是**所有协议交互的唯一接口**。
- trait 必须包含以下方法：`protocol` / `capabilities` / `connect` / `disconnect` /
  `list_directory` / `download_file` / `upload_file` / `delete_file` / `delete_directory` /
  `create_directory` / `move_file` / `get_working_dir` / `change_dir` / `is_connected`。
- **上层代码（SessionManager、Commands、前端 UI）不得直接 import `russh` / `reqwest` 等协议库，
  也不得包含任何 `if protocol == "sftp"` 之类的协议分支逻辑。**
- 上层通过 `Box<dyn FileTransport>` trait 对象调度；会话由 `SessionManager` 管理。
- **新增协议的标准步骤（零修改上层代码）**：
  1. 在 `src-tauri/src/transport/` 新建 `xxx_adapter.rs` 并实现 `FileTransport` 全部方法；
  2. 在 `Protocol` 枚举添加变体；
  3. 在 `create_adapter()` 工厂函数注册（`match protocol { ... }`）；
  4. 运行 `cargo test --test export_types` 同步 TS 类型；
  5. 完成。Commands / UI 无需任何改动。
- 每个 adapter 通过 `capabilities()` 返回 `AdapterCapability` 位标志，UI 据此**数据驱动**地
  决定显示哪些列与操作（如 WebDAV 隐藏 owner/permissions 列）。

### 2.2 全局枚举目录（ARCH-02，禁止魔法字符串）

- **所有常量、状态码、类型标识符必须定义为枚举**，集中在 `src-tauri/src/enums/`（按领域分文件）。
- **严禁在代码中硬编码魔法字符串**（如 `"sftp"`、`"connected"`、`"light"`、`"dark"` 等）。
- 枚举是全项目唯一真理源（single source of truth）。
- 通过 `ts-rs`（`#[derive(TS)]`）自动生成 TypeScript 类型到 `src/types/enums/` 与 `src/types/generated/`，
  **前端不得手写这些文件，也不得手动修改**——改 Rust 后重跑类型导出。
- 必需的 12 个枚举：`Protocol` `ConnectionStatus` `Theme` `Language` `SortColumn` `SortOrder`
  `ErrorCode` `FileOperation` `EditMode` `Platform` `TransferDirection` `AdapterCapability`。
- 所有导出枚举必须：`#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]`。
- `AdapterCapability` 是 `bitflags` 位标志（非普通枚举），UI 用位运算判断能力。
- **枚举或结构体变更后必须运行**：`cargo test --test export_types`（即 `bun run types:export`）以同步前端类型。

---

## 3. 首版范围与边界（SCOPE）

**已实现范围（首版）：**
- `SftpAdapter`（russh）/ `WebDavAdapter`（reqwest + quick-xml）完整实现 `FileTransport` trait。
- 桌面端 MVP + 功能补全（连接、浏览、上传下载、删除/重命名/移动、远程编辑、跨协议传输、设置）。
- 移动端适配（iOS / Android）。

**已预留但首版不实现（Protocol 变体已存在，工厂函数 `panic!` 兜底）：**
- `FtpAdapter`（suppaftp）、`S3Adapter`、`ScpAdapter` —— 列入后续迭代。

**非目标（MUST NOT 实现）：**
- Web 端（浏览器访问）；
- 内置终端模拟器；
- P2P 文件传输；
- 首版 FTP/FTPS adapter。

---

## 4. 命名与接口规范

- **命令名**：`snake_case`（Rust 惯例，如 `connect_host`、`list_directory`）。
- **命令参数名**：`camelCase`（前端惯例，Tauri 自动转换）。
- **事件名**：`namespace:action`（如 `connection:connected`、`download:progress`、`transfer:done`）。
- **错误格式**：统一 `AppError { code: ErrorCode, message: String, details?: serde_json::Value }`，
  由 Tauri 自动序列化；**禁止抛裸字符串或未经 `ErrorCode` 包裹的错误**。
- **协议无关性**：所有文件操作接口入参为 `hostId`，后端经 `SessionManager` 查会话并 trait 调度，
  前端不得感知具体协议。
- 详细接口清单见 `docs/03-api-spec.md`，错误码表见其第 11 节。

---

## 5. 安全约束（SECURITY）

- **密码加密**：AES-256-GCM，存储格式 `enc.v1:<Base64(nonce || ciphertext || tag)>`（nonce 12B、tag 16B）。
- **密钥存储**：Windows / macOS / Linux / iOS 使用 `keyring` 原生后端；Android 使用项目内
  `plugins/secure-storage` 调用 Android Keystore，以不可导出的 AES-GCM 密钥保护本机凭据。
  **禁止**在 Android 使用 `keyring` 的 mock backend，也禁止将密钥明文写入配置文件。
- **绝不（NEVER）将密码写入日志**。
- **配置迁移**：`configVersion` v1（SY-FTP 明文）→ v2 → v3（SY-TFM，当前）。
  旧版明文密码加载后自动升级为 `enc.v1:` 加密；配置文件损坏须回退默认值且不丢失主机列表。
- 配置统一存储于单一 `settings.json`，导出时经 `HostDto`（跳过密码字段）。

---

## 6. 代码规范（CI 强制）

**前端（ESLint + Prettier）：**
- ESLint 规则：`@typescript-eslint/no-unused-vars: error`、`@typescript-eslint/no-explicit-any: error`、
  `react/react-in-jsx-scope: off`、`react/prop-types: off`。
- Prettier：`semi: true`、`singleQuote: true`、`tabWidth: 2`、`trailingComma: "all"`、
  `printWidth: 100`，并启用 `prettier-plugin-tailwindcss`（自动排序 Tailwind class）。
- **禁止 `any` 类型**（CI 报错）；优先使用 `src/types/generated/` 与 `src/types/enums/` 中的类型。

**后端（Rust）：**
- 统一 `cargo fmt` 格式化 + `cargo clippy` 静态检查。
- **所有 `pub` 项必须有文档注释**（`///`）。
- **禁止在非测试代码中使用 `unwrap()` / `expect()`**；使用 `?` 与 `AppError` 构造器（见 `02-architecture.md` §10）。
- 错误类型使用 `thiserror` + `anyhow`；对外可见错误统一为 `AppError`。

**类型同步管线：**
- 任何 Rust 枚举/结构体（含 `#[derive(TS)]`）变更后，必须运行
  `cargo test --test export_types` 重新导出 TS 类型，并提交生成的 `src/types/**`。
- `src/types/enums/` 与 `src/types/generated/` 为自动生成目录，**禁止手工编辑**。

---

## 7. 模块结构（务必遵循）

**Rust 后端**（`src-tauri/src/`）：
```
enums/        全局枚举目录（唯一真理源，⚠️ 常量只放这里）
transport/    FileTransport trait + adapter 工厂 + SftpAdapter/WebDavAdapter
commands/     对前端暴露的 Tauri 命令（仅依赖 trait / SessionManager）
core/         SessionManager、FileWatcher 等核心业务
crypto/       SecretProtector（AES-256-GCM）+ key_storage
storage/      settings 读写 + migration
models/       RemoteHost / RemoteFile / AppSettings / HostDto / progress 等
error.rs      统一错误类型 AppError
```

**React 前端**（`src/`）：
```
pages/        页面级组件
features/     connection / browser / file-ops / editor / transfer 功能模块
components/   ui(shadcn) / layout / shared
stores/       Zustand：connectionStore / browserStore / settingsStore
hooks/        useTauriCommand / useTauriEvent / usePlatform
lib/          tauri.ts(IPC 封装) / i18n.ts / fileIcons.ts / utils.ts
types/        enums/（生成） + generated/（生成）
locales/      en.json / zh.json（i18n）
```

---

## 8. 平台约束

- 最低版本：iOS 14 / Android 12(API 31) / Windows 10(1809) / macOS 11 / Linux(Ubuntu 20.04+)。
- **平台适配零回归（HARD CONSTRAINT）**：任何 Android/iOS/桌面专项 UI、交互、路径或生命周期逻辑必须由原生平台判定显式隔离；禁止仅用视口宽度推断平台。新增平台适配不得改变其他既有平台的视觉、交互与存储行为，完成前必须运行并记录受影响平台与既有平台的回归验证。
- 响应式断点（Tailwind）：`mobile < 768px`（单列+底部 Tab+抽屉）、
  `tablet 768–1024px`（双列+可折叠侧栏）、`desktop > 1024px`（三列+侧栏+详情面板）。
- 桌面端：Ctrl/Shift 多选、橡皮筋框选、dnd-kit 拖拽；移动端：长按多选、左滑删除/右滑更多、下拉刷新、Haptic。
- 移动端文件系统差异：iOS 下载到 App Documents；Android 下载到公共 Downloads + SAF 选择。
- 后台连接管理（移动端）：进入后台 30s 后自动断开，回前台自动重连。

---

## 9. 禁止事项清单（MUST NOT）

1. ❌ 在代码中硬编码魔法字符串表示常量/状态/类型（必须用枚举）。
2. ❌ 绕过 `FileTransport` trait 直接调用协议库（russh/reqwest 等）。
3. ❌ 在上层（SessionManager / Commands / UI）写协议特化分支。
4. ❌ 将密码或密钥明文写入日志、配置文件或导出文件。
5. ❌ 在非测试 Rust 代码使用 `unwrap()` / `expect()`。
6. ❌ 在前端使用 `any` 类型（`@typescript-eslint/no-explicit-any` 为 error）。
7. ❌ 手工修改 `src/types/enums/` 或 `src/types/generated/` 下的生成文件。
8. ❌ 直接把 `sy-ftp-old-src/` 的 C# 代码搬进新项目（须用 Rust/React 重写）。
9. ❌ 引入 Web 端构建路径、终端模拟器或 P2P 传输（非目标）。
10. ❌ 变更加密格式而不更新迁移逻辑与 `configVersion`。
11. ❌ 新增常量不先放进 `enums/` 目录。
12. ❌ 前端使用 npm 作为包管理器（统一使用 bun，命令写为 `bun run ...`）。
13. ❌ 阶段性功能完成后未运行 `bun lint && bun format && bun test` 即提交或进入下一阶段。

---

## 10. 开发流程

- 采用渐进式 6 阶段（见 `docs/05-implementation-plan.md`）：
  `Phase 0 骨架 → Phase 1 桌面 MVP → Phase 2 功能补全 → Phase 3 移动端 → Phase 4 优化打磨 → Phase 5 发布`。
- 当前阶段：**Phase 2 已完成（Windows 桌面基线 v1.0.0）；下一阶段为 Phase 3 移动端适配**。
- **前端包管理器统一使用 bun**（不使用 npm）；文档与脚本中所有 `npm run ...` 一律改写为 `bun run ...`。
- **阶段性质量门禁（强制）**：每完成一个阶段性功能（里程碑 / Phase / 可提交的功能点），
  必须依次运行 `bun lint && bun format && bun test`，三者全部通过后方可提交代码或进入下一阶段。
- 每次开发会话结束后，按 `docs/06-progress-log.md` 附录规范更新进度日志（追加 Session 记录、ADR、任务状态、风险）。
- 架构决策以 ADR-001~022 为准；新决策须追加 ADR 并同步本文件。

---

## 11. 快速参考

| 动作 | 命令 |
|------|------|
| 开发启动 | `bun run tauri dev` |
| 桌面构建 | `bun run tauri build` |
| 移动端（Android） | `bun run tauri android dev/build` |
| 移动端（iOS） | `bun run tauri ios dev/build` |
| Rust 类型导出（TS 同步） | `cargo test --test export_types`（或 `bun run types:export`） |
| 前端检查 | `bun lint` / `bun format` |
| 阶段性质量门禁（强制） | `bun lint && bun format && bun test` |
| Rust 检查 | `cargo fmt` / `cargo clippy` |

**关键路径：**
- 协议抽象：`src-tauri/src/transport/`
- 全局枚举：`src-tauri/src/enums/`（后端）↔ `src/types/enums/`（前端生成）
- 会话调度：`src-tauri/src/core/session_manager.rs`
- 加密：`src-tauri/src/crypto/secret_protector.rs`

---

## 12. 依赖版本基线（DEPENDENCY BASELINE）

> 以下版本为本项目**锁定基线**，与 `docs/02-architecture.md` §2 保持一致。
> 初始化 `Cargo.toml` / `package.json` 时须以此为准；升级依赖须同步更新两处并说明理由。

### 12.1 后端 (Rust)

| Crate | 版本 |
|-------|------|
| tokio | 1.47 |
| russh | 0.62.2 |
| reqwest | 0.12 |
| quick-xml | 0.38 |
| aes-gcm | 0.10 |
| argon2 | 0.5 |
| sha2 | 0.10 |
| serde | 1.0 |
| serde_json | 1.0 |
| ts-rs | 11 |
| notify | 8 |
| fs2 | 0.4 |
| tracing | 0.1 |
| anyhow | 1 |
| thiserror | 2 |
| keyring | 3 |
| uuid | 1 |
| directories | 6 |
| parking_lot | 0.12 |
| tauri-plugin-single-instance | 2.4 |

### 12.2 前端 (React)

| 库 | 版本 |
|----|------|
| react | 19.1 |
| react-dom | 19.1 |
| vite | 7.1 |
| @tauri-apps/api | 2.8 |
| typescript | 5.9 |
| tailwindcss | 4.1 |
| @tailwindcss/vite | 4.1 |
| shadcn/ui | latest |
| zustand | 5.0 |
| @tanstack/react-query | 5.8x |
| react-router | 7.8 |
| i18next | 25 |
| react-i18next | 15 |
| lucide-react | 0.54x |
| @uiw/react-codemirror | 4.24 |
| @tanstack/react-virtual | 3.13 |
| @dnd-kit/core | 6.3 |
| @dnd-kit/sortable | 10.0 |
| @dnd-kit/modifiers | 9.0 |
| @dnd-kit/utilities | 3.2 |
| sonner | 2.0 |
| react-hook-form | 7.62 |
| zod | 4.1 |
| clsx | 2.1 |
| tailwind-merge | 3.3 |
| class-variance-authority | 0.7 |

### 12.3 前端开发依赖 (DevDependencies)

| 库 | 版本 |
|----|------|
| eslint | 9.35 |
| eslint-plugin-react-hooks | 5.x |
| typescript-eslint | 8.x |
| prettier | 3.6 |
| prettier-plugin-tailwindcss | 0.6 |
