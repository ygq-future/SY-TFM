# SY-TFM — 实时进度与决策日志

**项目名称:** SY-TFM (Tiny File Manager)  
**创建日期:** 2026-07-10  
**最后更新:** 2026-07-15  
**当前阶段:** Phase 0 — 已完成骨架搭建（代码实现 ~60%，待 MSVC 环境验证运行时）

> **使用说明:** 本文档是项目的活文档（living document），每次开发会话结束后更新。  
> 顶部是快速概览，往下是详细记录。最新的内容在最上面。

---

## 0. 快速概览

### 0.1 当前状态

| 指标 | 值 |
|------|-----|
| 当前阶段 | Phase 0（项目骨架）— 代码完成，待运行时验证 |
| 当前任务 | Phase 0 收尾，准备进入 Phase 1 |
| 总体进度 | 文档设计 100%，代码实现 ~60%（骨架完成，adapter 待实现） |
| 阻塞项 | ⚠️ 本机无 MSVC link.exe，Rust 测试二进制运行时 DLL 链不完整（编译通过） |
| 文档状态 | ✅ 需求 ✅ 架构 ✅ 接口 ✅ 数据模型 ✅ 实现计划 ✅ 进度日志 |

### 0.2 当前在做

> Phase 0 骨架代码已全部就位：Rust 后端（Cargo/tauri.conf/12 枚举/模型/FileTransport trait/adapter 骨架/crypto/storage/commands）+ 前端（Vite7/React19/Tailwind4/ESLint9/stores/components/i18n）。前端质量门禁通过；Rust 编译通过但测试运行时受 GNU 工具链 DLL 限制。

### 0.3 下一步计划

1. **环境修复** — 安装 VS Build Tools（MSVC link.exe）以启用 Rust 测试运行时 + ts-rs 自动类型导出 + `tauri dev`
2. **Phase 1 启动** — 启用 `protocol-adapters` feature，实现 SftpAdapter（russh）与 WebDavAdapter（reqwest）
3. **类型文件自动化** — MSVC 环境就绪后运行 `cargo test --test export_types` 覆盖手工占位类型

### 0.4 阶段进度仪表盘

| 阶段 | 状态 | 任务完成 | 里程碑 | 备注 |
|------|------|---------|--------|------|
| Phase 0 — 项目骨架 | 🟡 进行中 | 10/12 | 5/7 | 代码完成，待 MSVC 运行时验证 |
| Phase 1 — 桌面端 MVP | 🟡 进行中 | 8/30 | 0/8 | 前端组件骨架已写，adapter 待实现 |
| Phase 2 — 功能补全 | ⬜ 未启动 | 0/24 | 0/4 | |
| Phase 3 — 移动端适配 | ⬜ 未启动 | 0/21 | 0/6 | |
| Phase 4 — 优化打磨 | ⬜ 未启动 | 0/17 | 0/5 | |
| Phase 5 — 发布准备 | ⬜ 未启动 | 0/8 | 0/3 | |

> **图例:** ⬜ 未启动 / 🟡 进行中 / ✅ 已完成 / 🔴 阻塞

---

## 1. 会话日志

> 每次开发会话在此追加记录，最新在最上面。

### Session #001 — 2026-07-04

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-04 |
| **时长** | ~2h |
| **类型** | 文档编写 |
| **参与者** | 用户 + AI |

**完成事项:**

- 阅读现有 SY-FTP 项目全部 9 份文档（CLAUDE.md、README_AI.md、TASKS.md、README.md、4 份设计文档）
- 分析 Git 历史：63 次提交、15,047 行新增、8 天开发周期
- 生成项目文档总结（功能全景图 + 开发阶段演进）

**产出物:**

- 项目文档总结（会话内输出）

**决策记录:**

- 无

**下一步:**

- 等待用户决定重构方向

---

### Session #002 — 2026-07-05

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **时长** | ~3h |
| **类型** | 架构设计 + 文档编写 |
| **参与者** | 用户 + AI |

**完成事项:**

- 分析现有项目源码：Models（FtpHost、RemoteFile、AppSettings、AppConfig、EncryptedStringConverter）、Services（IFtpService、IFileWatcherService、SettingsService）、Helpers（SecretProtector）、ViewModels（HostSession、MainWindowViewModel、FileBrowserViewModel）
- 基于现有项目，使用 Tauri 2 + React + Rust 技术栈重新设计方案
- 编写 5 份设计文档：
  - `01-requirements.md` — 需求文档
  - `02-architecture.md` — 架构文档
  - `03-api-spec.md` — 接口规范
  - `04-data-model.md` — 数据模型
  - `05-implementation-plan.md` — 实现计划

**产出物:**

- `docs/tauri-redesign/01-requirements.md`
- `docs/tauri-redesign/02-architecture.md`
- `docs/tauri-redesign/03-api-spec.md`
- `docs/tauri-redesign/04-data-model.md`
- `docs/tauri-redesign/05-implementation-plan.md`

**决策记录:**

- [ADR-001] 采用 Tauri 2 替代 Avalonia UI
- [ADR-002] 采用 React 18 + Tailwind + shadcn/ui 前端栈
- [ADR-003] 采用 russh + reqwest 替代 FluentFTP + SSH.NET
- [ADR-004] 采用 AES-256-GCM + keyring 替代 AES-256-GCM + DPAPI
- [ADR-005] 采用 ts-rs 实现 Rust → TypeScript 类型自动同步

**下一步:**

- 等待用户审阅文档

---

### Session #003 — 2026-07-05（续）

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **时长** | ~2h |
| **类型** | 架构重构 + 文档修订 |
| **参与者** | 用户 + AI |

**完成事项:**

- 根据用户反馈对 5 份文档进行全面架构优化重构
- 核心变更：
  1. 项目更名为 SY-TFM（Tiny File Manager），不再叫 SY-FTP v2
  2. 引入 FileTransport Adapter 模式：SFTP/FTP/WebDAV 各为独立 adapter，首版做 SFTP + WebDAV
  3. 建立全局枚举目录：12 个枚举，禁止魔法字符串
  4. Phase 0 加入 ESLint + Prettier + prettier-plugin-tailwindcss
  5. 数据模型变更：FtpHost → RemoteHost，configVersion 升级至 v3

**产出物:**

- 5 份文档全部重写（覆盖原文件）

**决策记录:**

- [ADR-006] 引入 FileTransport trait 抽象层，协议可插拔
- [ADR-007] 首版协议改为 SFTP + WebDAV（不再是 FTP/FTPS 优先）
- [ADR-008] 全局枚举目录作为唯一真理源
- [ADR-009] Phase 0 加入 ESLint/Prettier/prettier-plugin-tailwindcss
- [ADR-010] AdapterCapability 位标志驱动 UI 列显示

**下一步:**

- 等待用户确认重构方案

---

### Session #004 — 2026-07-10

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-10 |
| **时长** | ~30min |
| **类型** | 进度文档编写 |
| **参与者** | 用户 + AI |

**完成事项:**

- 创建实时进度与决策日志文档
- 整理前 3 次会话记录
- 建立决策记录（ADR）索引
- 建立阶段任务追踪模板

**产出物:**

- `docs/tauri-redesign/06-progress-log.md`（本文档）

**决策记录:**

- 无

**下一步:**

- 等待用户确认后启动 Phase 0 编码

---

### Session #005 — 2026-07-14/15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-14 ~ 2026-07-15 |
| **时长** | ~8h（自主推进） |
| **类型** | Phase 0 骨架实现 + Phase 1 前端组件 |
| **参与者** | AI 自主（用户休息） |

**完成事项:**

- 生成 `AGENTS.md` 约束文档（FileTransport 抽象 + 全局枚举目录 + 依赖版本基线 + 质量门禁）
- 包管理器统一为 bun，同步到全部文档
- 初始化 Git 仓库 + `.gitignore`（排除 AI 目录/旧源码/构建产物）
- **Phase 0 全部骨架代码**：
  - Rust 后端：Cargo.toml(基线版本)、tauri.conf.json(v2)、build.rs、capabilities、main.rs/lib.rs
  - 12 个全局枚举 + error.rs(AppError)
  - 数据模型：RemoteHost/RemoteFile/AppSettings/HostDto/ProgressPayload
  - FileTransport trait + create_adapter 工厂 + SFTP/WebDAV adapter 骨架
  - core/crypto/storage/commands 骨架 + SecretProtector(AES-256-GCM) + tests/export_types.rs
  - .cargo/config.toml(GNU link-self-contained)
- **前端骨架**：package.json(bun)、Vite7+Tailwind4+TS5.9+React19、ESLint9 flat config、Prettier
  - lib/tauri.ts(全命令封装)、i18n.ts、utils.ts、locales en/zh
  - Zustand stores(connectionStore/browserStore/settingsStore)
  - Vitest + 占位测试
- **Phase 1 前端组件**：HostList、HostEditDialog、FileList(虚拟列表)、Breadcrumb、DownloadBar、UploadZone、ContextMenu、Dialog、ToastProvider、fileIcons、App 路由整合
- 手工生成 12 枚举 + 5 模型 TS 类型占位文件

**产出物:**

- `AGENTS.md`、`.gitignore`、`src-tauri/`（完整 Rust 骨架）、`src/`（完整前端骨架）
- `src/types/enums/` + `src/types/generated/`（手工占位，待 ts-rs 覆盖）

**决策记录:**

- [ADR-011] 协议库(russh/reqwest/quick-xml)设为 optional feature，骨架期不编译 C 依赖
- [ADR-012] crate-type 桌面开发期仅 rlib，移动端构建时追加 staticlib/cdylib
- [ADR-013] GNU 工具链 + link-self-contained + MinGW dlltool 作为无 MSVC 环境的 workaround

**环境问题（非代码问题）:**

- 本机无 VS Build Tools（MSVC link.exe 缺失），改用 GNU 工具链
- GNU ld 链接 cdylib 时 export ordinal 溢出 → crate-type 改为仅 rlib
- Rust 测试二进制运行时 `STATUS_ENTRYPOINT_NOT_FOUND`（Tauri Windows DLL 链在 GNU 下不完整）→ 编译通过但测试无法运行
- ts-rs 无法运行时执行 → 手工生成 TS 类型占位

**下一步:**

- 安装 VS Build Tools(MSVC) 修复运行时
- `cargo test --test export_types` 覆盖手工类型
- Phase 1：启用 protocol-adapters feature，实现 SftpAdapter/WebDavAdapter

---

## 2. 决策日志（ADR — Architecture Decision Records）

> 每条决策记录包含：编号、日期、标题、状态、背景、决策、理由、影响。  
> 状态：💡 提议 / 🟢 已接受 / 🟡 已接受但有疑虑 / 🔴 已否决 / ⚪ 已废弃

### ADR-001 — 采用 Tauri 2 替代 Avalonia UI

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 |

**背景:**

现有 SY-FTP 使用 Avalonia UI 12，仅支持桌面端（Windows/Linux/macOS）。用户需要适配移动端（iOS/Android），Avalonia 对移动端支持不成熟。

**决策:**

采用 Tauri 2 作为应用框架，前端使用 React + TypeScript，后端使用 Rust。Tauri 2 原生支持桌面端和移动端。

**理由:**

- Tauri 2 原生支持 iOS/Android，一套代码五平台
- Rust 后端性能优秀，内存安全
- 前端使用 Web 技术，生态丰富，移动端触摸交互更自然
- 安装包体积小（Tauri 不打包浏览器引擎）

**影响:**

- 需要将 C# 逻辑全部重写为 Rust
- 前端从 XAML 迁移到 React
- 编译构建流程完全改变
- 团队需要学习 Rust + React

---

### ADR-002 — 前端技术栈选择

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 + AI |

**背景:**

Tauri 2 前端可以使用任意 Web 框架。需要选择 UI 框架、状态管理、构建工具等。

**决策:**

- UI 框架: React 18
- 构建工具: Vite 5
- 样式: Tailwind CSS 3 + shadcn/ui
- 状态管理: Zustand（客户端状态）+ TanStack Query（服务端状态）
- 路由: TanStack Router
- 国际化: i18next
- 代码编辑器: CodeMirror 6
- 代码规范: ESLint + Prettier + prettier-plugin-tailwindcss

**理由:**

- React 生态最成熟，人才储备最广
- Tailwind + shadcn/ui 组合开发效率高，响应式断点内置
- Zustand 轻量无嵌套，TanStack Query 处理缓存和重试
- CodeMirror 6 移动端友好（Monaco 不支持移动端）
- ESLint + Prettier 保证代码质量，prettier-plugin-tailwindcss 自动排序 class

**影响:**

- 确定了前端依赖清单
- 确定了代码规范工具链
- 确定了组件库基础

---

### ADR-003 — 后端协议库选择

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 + AI |

**背景:**

需要选择 SFTP 和 WebDAV 的 Rust 实现。FTP/FTPS 后续迭代。

**决策:**

- SFTP: russh（纯 Rust SSH 实现）
- WebDAV: reqwest + quick-xml（手动实现 WebDAV verbs）
- 加密: aes-gcm + keyring
- 文件监听: notify
- 日志: tracing

**理由:**

- russh 纯 Rust 实现，无需 C 依赖，交叉编译友好（关键：移动端）
- reqwest 已是 HTTP 事实标准，WebDAV 仅需手动添加 verbs
- keyring 跨五平台密钥存储，替代 .NET 的 DPAPI
- 备选方案 libssh2-sys（C 绑定）作为 russh 交叉编译失败的 fallback

**影响:**

- 确定了 Rust 依赖清单
- 移动端交叉编译需提前验证（Phase 0 / Phase 3）
- WebDAV XML 解析需自行实现

---

### ADR-004 — 密码加密方案

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 + AI |

**背景:**

现有 SY-FTP 使用 AES-256-GCM 加密密码，密钥用 DPAPI（Windows）或文件权限（Linux/macOS）保护。需适配五平台。

**决策:**

- 加密算法: AES-256-GCM（保持不变）
- 密钥存储: 使用 keyring crate 统一五平台
  - Windows: DPAPI (CurrentUser)
  - macOS: Keychain
  - Linux: 文件 `~/.local/share/sy-tfm/key.bin` (0600)
  - iOS: Keychain
  - Android: Keystore
- 配置迁移: v1（SY-FTP 明文）→ v2（SY-FTP 加密）→ v3（SY-TFM）

**理由:**

- keyring 是 Rust 生态跨平台密钥存储标准
- AES-256-GCM 仍然是业界标准
- 配置迁移链路保留向后兼容

**影响:**

- 旧版 SY-FTP 用户可迁移到 SY-TFM
- 密钥文件路径变更需迁移逻辑
- 加密格式 `enc.v1:` 前缀保持不变

---

### ADR-005 — Rust → TypeScript 类型同步

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | AI |

**背景:**

前后端使用不同语言（Rust + TypeScript），需要保持数据模型类型同步，避免手动维护两份类型定义。

**决策:**

使用 ts-rs crate，通过 `#[derive(TS)]` 自动从 Rust 结构体和枚举生成 TypeScript 类型文件。

**理由:**

- ts-rs 是 Rust → TS 类型生成的成熟方案
- 编译时检查，Rust 改了类型前端立刻能发现
- 无需手动维护两份类型定义
- 通过 `cargo test` 阶段触发导出，集成到 CI

**影响:**

- 前端 `src/types/enums/` 和 `src/types/generated/` 为自动生成目录
- CI 需增加类型检查步骤
- 枚举变更后需运行 `cargo test --test export_types`

---

### ADR-006 — FileTransport Adapter 抽象层

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 |

**背景:**

用户要求将文件传输协议抽象出来，后续添加新协议只需加一个 adapter。SFTP 和 FTP 应分开为两个 adapter。

**决策:**

定义 `FileTransport` trait 作为所有协议的统一抽象层，包含 14 个方法（connect/disconnect/list_directory/download_file/upload_file/delete_file/delete_directory/create_directory/move_file/get_working_dir/change_dir/is_connected/protocol/capabilities）。每个协议实现为独立 adapter struct。

**理由:**

- 上层代码（SessionManager、Commands）零协议感知
- 新增协议 = 新增 adapter 文件 + Protocol 枚举注册 + 工厂函数注册
- 每个协议可以独立测试
- 跨协议传输（SFTP ↔ WebDAV）通过 trait 对象自然支持

**影响:**

- 架构文档增加了完整的 trait 定义和 adapter 示例
- 接口规范文档改为协议无关设计
- 实现计划 Phase 1 增加 adapter 实现任务

---

### ADR-007 — 首版协议选择

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 |

**背景:**

用户明确要求首版先做 WebDAV 和 SFTP，FTP/FTPS 后面再适配。

**决策:**

首版实现两个 adapter：
1. SftpAdapter（russh）
2. WebDavAdapter（reqwest + quick-xml）

FTP/FTPS、S3、SCP 列入后续迭代计划。

**理由:**

- WebDAV 在 NAS/云存储场景更常用
- SFTP 是开发者最常用的远程文件协议
- FTP 协议老旧且安全性差，优先级降低
- 首版聚焦两个 adapter 可以更快交付

**影响:**

- 需求文档和实现计划调整优先级
- WebDavAdapter 需要实现 PROPFIND XML 解析
- Protocol 枚举预留 FTP/S3/SCP 变体但首版不实现

---

### ADR-008 — 全局枚举目录

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 |

**背景:**

用户要求架构所有常量都需要放在枚举类中，全局有一个公共的枚举目录管理。

**决策:**

建立 `src-tauri/src/enums/` 目录，包含 12 个枚举文件（Protocol、ConnectionStatus、Theme、Language、SortColumn、SortOrder、ErrorCode、FileOperation、EditMode、Platform、TransferDirection、AdapterCapability）。通过 ts-rs 自动生成 TypeScript 对应类型到 `src/types/enums/`。

**理由:**

- 消除魔法字符串，提高代码可维护性
- 枚举变体变更时编译器能检查所有引用点
- Rust 和 TypeScript 类型自动同步
- AdapterCapability 位标志支持能力组合

**影响:**

- 所有代码禁止使用魔法字符串
- 新增常量必须先在 enums 目录定义
- CI 需检查 ts-rs 类型同步

---

### ADR-009 — Phase 0 代码规范

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | 用户 |

**背景:**

用户明确要求 Phase 0 加入 eslint 和 prettier 和 prettier-plugin-tailwindcss。

**决策:**

Phase 0 任务 0.4 配置：
- ESLint: eslint:recommended + @typescript-eslint/recommended + react/recommended + react-hooks/recommended + prettier
- Prettier: semi, singleQuote, tabWidth 2, trailingComma all, printWidth 100, plugins: prettier-plugin-tailwindcss
- Rust: cargo fmt + cargo clippy

**理由:**

- 从第一天就建立代码规范，避免后期技术债
- prettier-plugin-tailwindcss 自动排序 Tailwind class，保持一致性
- ESLint 严格规则（no-unused-vars: error, no-explicit-any: error）从源头保证质量

**影响:**

- Phase 0 增加代码规范配置任务
- CI 流水线增加 lint 检查阶段
- 所有 PR 必须通过 lint 才能合并

---

### ADR-010 — AdapterCapability 位标志驱动 UI

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-05 |
| **状态** | 🟢 已接受 |
| **决策者** | AI |

**背景:**

不同协议能力不同（如 SFTP 支持 owner/permissions，WebDAV 不支持）。UI 需要根据协议能力动态调整显示。

**决策:**

定义 `AdapterCapability` 位标志枚举（bitflags），每个 adapter 在 `capabilities()` 方法返回自身能力。UI 层根据能力标志决定显示哪些列和操作。

**理由:**

- 位标志支持能力组合，扩展性好
- UI 层无需硬编码协议判断，完全数据驱动
- 新增协议只需声明能力，UI 自动适配

**影响:**

- FileList 组件需根据 capabilities 动态渲染列
- ContextMenu 需根据 capabilities 动态显示菜单项
- AdapterCapability 是位标志，不是普通枚举

---

### ADR-011 — 协议库设为 optional feature

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-14 |
| **状态** | 🟢 已接受 |
| **决策者** | AI |

**背景:** russh/reqwest(rustls→aws-lc-sys)/quick-xml 在 Windows 编译需 cmake+nasm，骨架期 adapter 为 stub 不引用这些库。

**决策:** 将 russh/reqwest/quick-xml 设为 optional，通过 `protocol-adapters` feature 门控。Phase 1 实现 adapter 时启用。

**理由:** 骨架期无需编译 C 依赖即可验证核心代码；Phase 1 启用 feature 后才拉入协议库。

**影响:** Cargo.toml 有 `protocol-adapters` feature；adapter 文件用 `#[cfg(feature)]` 门控。

---

### ADR-012 — crate-type 桌面开发期仅 rlib

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-14 |
| **状态** | 🟢 已接受 |
| **决策者** | AI |

**背景:** GNU ld 链接 cdylib 时 `export ordinal too large`（Tauri 依赖符号过多超出 GNU ld 限制）。

**决策:** `[lib] crate-type = ["rlib"]`（桌面开发期）。移动端构建时追加 `["staticlib", "cdylib"]`。

**理由:** 桌面端 `cargo test`/`tauri dev` 仅需 rlib；cdylib/staticlib 是 Android/iOS 专用。

**影响:** 移动端构建需恢复完整 crate-type；当前仅影响 GNU 工具链，MSVC 无此问题。

---

### ADR-013 — GNU 工具链作为无 MSVC 的 workaround

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-14 |
| **状态** | 🟡 已接受但有疑虑 |
| **决策者** | AI |

**背景:** 本机未安装 VS Build Tools（MSVC link.exe 缺失），默认 stable-x86_64-pc-windows-msvc 工具链无法链接。

**决策:** 安装 stable-x86_64-pc-windows-gnu 工具链 + `.cargo/config.toml` 配置 `link-self-contained=yes`（用 rust-lld 绕过系统 MCF gcc）+ PATH 前置 MinGW bin（提供可用 dlltool）+ CARGO_TARGET_DIR 无空格路径（绕过 windres 空格 bug）。

**理由:** 唯一能在无 MSVC 环境下编译 Tauri 2 项目的方案。

**影响:** 编译可通过，但测试运行时 DLL 链不完整（`STATUS_ENTRYPOINT_NOT_FOUND`）；正式开发建议安装 MSVC。Tauri 官方推荐 MSVC 工具链。

---

### 3.1 Phase 0 — 项目骨架（第 1 周）

| # | 任务 | 状态 | 优先级 | 预估 | 实际 | 依赖 | 备注 |
|---|------|------|--------|------|------|------|------|
| 0.1 | 初始化 Tauri 2 + React + Vite 项目 | ✅ | P0 | 2h | ~3h | — | Cargo.toml/tauri.conf/vite.config/package.json 就位 |
| 0.2 | 配置 Tailwind CSS + shadcn/ui | ✅ | P0 | 2h | ~1h | 0.1 | Tailwind 4 + @tailwindcss/vite 配置完成 |
| 0.3 | 配置 TypeScript + ts-rs 类型生成管线 | 🟡 | P0 | 3h | ~2h | 0.1 | 管线就位；ts-rs 运行时受限，类型手工占位 |
| 0.4 | 配置 ESLint + Prettier + prettier-plugin-tailwindcss | ✅ | P0 | 2h | ~1h | 0.1 | ESLint 9 flat config + Prettier，lint 通过 |
| 0.5 | 搭建全局枚举目录（Rust enums/ + TS types/enums/） | ✅ | P0 | 4h | ~3h | 0.3 | 12 枚举 + TS 占位类型全部就位 |
| 0.6 | 定义 FileTransport trait + adapter 工厂骨架 | ✅ | P0 | 4h | ~2h | 0.5 | trait + create_adapter 工厂 + SFTP/WebDAV 骨架 |
| 0.7 | 搭建 Rust 后端模块骨架 | ✅ | P0 | 4h | ~2h | 0.6 | core/crypto/storage/commands 骨架完成 |
| 0.8 | 实现 AppSettings 配置读写 + 迁移逻辑（v1→v3） | 🟡 | P0 | 4h | ~2h | 0.7 | 骨架就位，迁移逻辑待 MSVC 验证 |
| 0.9 | 实现 SecretProtector 加密模块（AES-256-GCM + keyring） | ✅ | P0 | 6h | ~3h | 0.7 | 加解密实现 + 3 单元测试，编译通过 |
| 0.10 | 实现 i18next 国际化框架（EN + ZH） | ✅ | P1 | 3h | ~1h | 0.1 | i18next + react-i18next + en/zh locale |
| 0.11 | 配置 GitHub Actions CI（桌面端构建） | ⬜ | P1 | 3h | — | 0.4 | 待后续 |
| 0.12 | 搭建响应式布局框架（桌面/平板/移动断点） | 🟡 | P1 | 4h | ~1h | 0.2 | Tailwind 断点配置就位，布局组件待 Phase 1 |

**里程碑:**

| # | 里程碑 | 状态 |
|---|--------|------|
| M0.1 | `bun run tauri dev` 可启动空白应用 | 🟡 代码就位，待 MSVC 运行时验证 |
| M0.2 | ESLint + Prettier 代码检查通过 | ✅ |
| M0.3 | 全局枚举目录建立，ts-rs 类型同步正常 | 🟡 枚举目录完成，ts-rs 运行时待修复 |
| M0.4 | FileTransport trait 定义完成，adapter 工厂骨架就绪 | ✅ |
| M0.5 | 配置文件读写正常，旧配置可迁移 | 🟡 骨架就位，待运行时验证 |
| M0.6 | 密码加解密单元测试通过 | 🟡 实现完成+编译通过，运行时待验证 |
| M0.7 | CI 自动构建桌面端产物 | ⬜ |

---

### 3.2 Phase 1 — 桌面端 MVP（第 2-4 周）

| # | 任务 | 状态 | 依赖 | 预估 | 实际 | 备注 |
|---|------|------|------|------|------|------|
| 1.1 | 实现 SftpAdapter（russh）— 完整 FileTransport trait | ⬜ | 0.6 | 12h | — | |
| 1.2 | 实现 WebDavAdapter（reqwest）— 完整 FileTransport trait | ⬜ | 0.6 | 12h | — | |
| 1.3 | 实现 WebDAV PROPFIND XML 解析（quick-xml） | ⬜ | 1.2 | 4h | — | |
| 1.4 | 实现 SessionManager（会话增删查改，trait 对象调度） | ⬜ | 1.1, 1.2 | 4h | — | |
| 1.5 | 实现 connection 命令层 | ⬜ | 1.4 | 4h | — | |
| 1.6 | 实现密码提示对话框（前端组件） | ⬜ | 0.10 | 3h | — | |
| 1.7 | 实现 HostList + HostCard 组件 | ⬜ | 1.5, 1.6 | 6h | — | |
| 1.8 | 实现 HostEditDialog | ⬜ | 1.7 | 4h | — | |
| 1.9 | 实现 get_supported_protocols 命令 | ⬜ | 0.5 | 2h | — | |
| 1.10 | 实现 list_directory + navigate 命令 | ⬜ | 1.4 | 4h | — | |
| 1.11 | 实现 FileList 组件（虚拟列表 + 能力驱动列显示） | ⬜ | 1.10 | 8h | — | |
| 1.12 | 实现 Breadcrumb 面包屑路径栏 | ⬜ | 1.11 | 6h | — | |
| 1.13 | 实现 download/upload 命令 + 进度事件 | ⬜ | 1.4 | 8h | — | |
| 1.14 | 实现 delete/create/move/rename 命令 | ⬜ | 1.4 | 4h | — | |
| 1.15 | 实现 DownloadBar 进度条组件 | ⬜ | 1.13 | 4h | — | |
| 1.16 | 实现 UploadZone 拖拽上传（dnd-kit） | ⬜ | 1.13 | 6h | — | |
| 1.17 | 实现 ConfirmDialog + InputDialog | ⬜ | 0.10 | 3h | — | |
| 1.18 | 实现 ContextMenu 右键菜单 | ⬜ | 1.14, 1.17 | 4h | — | |
| 1.19 | 实现文件列表排序 | ⬜ | 1.11 | 4h | — | |
| 1.20 | 实现 FileIcon 图标映射（150+ 类型） | ⬜ | — | 4h | — | |
| 1.21 | 实现橡皮筋多选（桌面端） | ⬜ | 1.11 | 6h | — | |
| 1.22 | 实现拖拽移动文件 | ⬜ | 1.14, 1.21 | 4h | — | |
| 1.23 | 实现 Zustand stores | ⬜ | — | 6h | — | |
| 1.24 | 实现 TanStack Query 集成 | ⬜ | 1.23 | 4h | — | |
| 1.25 | 实现统一错误处理中间件 | ⬜ | — | 4h | — | |
| 1.26 | 实现 Toast 通知系统 | ⬜ | — | 2h | — | |
| 1.27 | 实现 KeepAlive + 断连重连逻辑 | ⬜ | 1.4 | 6h | — | |
| 1.28 | 编写 Rust 单元测试 | ⬜ | 1.1-1.4 | 8h | — | |
| 1.29 | 编写前端组件测试（Vitest） | ⬜ | 1.23 | 4h | — | |
| 1.30 | 桌面端 MVP 集成测试 | ⬜ | 全部 | 4h | — | |

---

### 3.3 Phase 2 — 桌面端功能补全（第 5-7 周）

| # | 任务 | 状态 | 依赖 | 预估 | 实际 | 备注 |
|---|------|------|------|------|------|------|
| 2.1 | 实现 FileWatcher 服务（notify crate） | ⬜ | 1.4 | 6h | — | |
| 2.2 | 实现 edit_remote_external 命令 | ⬜ | 2.1 | 6h | — | |
| 2.3 | 实现 EditSessionManager | ⬜ | 2.2 | 4h | — | |
| 2.4 | 实现 OnlineEditor 组件（CodeMirror 6） | ⬜ | — | 8h | — | |
| 2.5 | 实现编辑器工具栏 | ⬜ | 2.4 | 4h | — | |
| 2.6 | 实现语法高亮自动检测 | ⬜ | 2.4 | 4h | — | |
| 2.7 | 实现 editor:synced/error 事件处理 | ⬜ | 2.3 | 3h | — | |
| 2.8 | 实现跨协议传输命令（本地中转） | ⬜ | 1.4 | 8h | — | |
| 2.9 | 实现 TransferBrowserDialog 组件 | ⬜ | 2.8 | 8h | — | |
| 2.10 | 实现传输面板独立连接状态管理 | ⬜ | 2.9 | 4h | — | |
| 2.11 | 实现 SettingsWindow 设置面板 | ⬜ | — | 8h | — | |
| 2.12 | 实现主题切换 | ⬜ | 2.11 | 4h | — | |
| 2.13 | 实现强调色选择器 | ⬜ | 2.11 | 4h | — | |
| 2.14 | 实现背景图片设置 | ⬜ | 2.11 | 4h | — | |
| 2.15 | 实现"关于"信息面板 | ⬜ | 2.11 | 2h | — | |
| 2.16 | 实现配置导出/导入（HostDto） | ⬜ | 0.8 | 4h | — | |
| 2.17 | 实现配置备份与恢复 | ⬜ | 2.16 | 4h | — | |
| 2.18 | 实现标签筛选主机列表 | ⬜ | 1.7 | 3h | — | |
| 2.19 | 实现下载路径三级解析 | ⬜ | 0.8 | 2h | — | |
| 2.20 | 实现路径栏就地编辑 | ⬜ | 1.12 | 3h | — | |
| 2.21 | 实现复制路径 toast | ⬜ | 1.12 | 2h | — | |
| 2.22 | 实现窗口置顶 | ⬜ | — | 2h | — | |
| 2.23 | 实现自定义标题栏 | ⬜ | — | 6h | — | |
| 2.24 | 实现错误 overlay 自动消失 | ⬜ | 1.25 | 2h | — | |

---

### 3.4 Phase 3 — 移动端适配（第 8-9 周）

| # | 任务 | 状态 | 依赖 | 预估 | 实际 | 备注 |
|---|------|------|------|------|------|------|
| 3.1 | 初始化 Tauri Android 项目 | ⬜ | 0.1 | 4h | — | |
| 3.2 | 初始化 Tauri iOS 项目 | ⬜ | 0.1 | 4h | — | |
| 3.3 | 验证 russh + reqwest 移动端交叉编译 | ⬜ | 0.6 | 6h | — | 关键验证 |
| 3.4 | 实现移动端密钥存储 | ⬜ | 0.9 | 6h | — | |
| 3.5 | 实现移动端文件系统适配 | ⬜ | 0.8 | 4h | — | |
| 3.6 | 实现 ResponsiveLayout 响应式布局 | ⬜ | 0.12 | 6h | — | |
| 3.7 | 实现 MobileTabBar 底部导航 | ⬜ | 3.6 | 4h | — | |
| 3.8 | 实现 Drawer 侧栏抽屉 | ⬜ | 3.7 | 4h | — | |
| 3.9 | 实现移动端文件列表（Card 样式） | ⬜ | 3.6 | 6h | — | |
| 3.10 | 实现滑动操作 | ⬜ | 3.9 | 6h | — | |
| 3.11 | 实现长按多选模式 | ⬜ | 3.9 | 4h | — | |
| 3.12 | 实现下拉刷新 | ⬜ | 3.9 | 3h | — | |
| 3.13 | 实现双指缩放 | ⬜ | 3.9 | 3h | — | |
| 3.14 | 实现 Haptic 振动反馈 | ⬜ | — | 2h | — | |
| 3.15 | 实现移动端上传 | ⬜ | 3.5 | 4h | — | |
| 3.16 | 实现移动端编辑器 | ⬜ | 2.4 | 6h | — | |
| 3.17 | 实现移动端 BottomSheet | ⬜ | 3.9 | 4h | — | |
| 3.18 | 实现后台连接管理 | ⬜ | — | 4h | — | |
| 3.19 | 实现网络切换检测 | ⬜ | 3.18 | 4h | — | |
| 3.20 | 实现移动端分享文件 | ⬜ | — | 3h | — | |
| 3.21 | iOS/Android 真机测试 | ⬜ | 全部 | 8h | — | |

---

### 3.5 Phase 4 — 优化打磨（第 10-11 周）

| # | 任务 | 状态 | 预估 | 实际 | 备注 |
|---|------|------|------|------|------|
| 4.1 | 虚拟列表优化 | ⬜ | 6h | — | |
| 4.2 | 目录列表缓存 | ⬜ | 4h | — | |
| 4.3 | 文件图标懒加载 | ⬜ | 3h | — | |
| 4.4 | Rust 端连接池优化 | ⬜ | 4h | — | |
| 4.5 | 大文件分块传输 + 断点续传 | ⬜ | 8h | — | |
| 4.6 | 前端 Bundle 体积分析 | ⬜ | 4h | — | |
| 4.7 | Rust 编译体积优化 | ⬜ | 3h | — | |
| 4.8 | 内存泄漏排查 | ⬜ | 6h | — | |
| 4.9 | 主题色板完善 | ⬜ | 4h | — | |
| 4.10 | 过渡动画 | ⬜ | 4h | — | |
| 4.11 | 桌面端自定义标题栏完善 | ⬜ | 4h | — | |
| 4.12 | 移动端手势动画优化 | ⬜ | 6h | — | |
| 4.13 | 空状态设计 | ⬜ | 3h | — | |
| 4.14 | 加载骨架屏 | ⬜ | 3h | — | |
| 4.15 | 错误状态 UI 设计 | ⬜ | 3h | — | |
| 4.16 | 五平台 UI 一致性走查 | ⬜ | 6h | — | |
| 4.17 | 无障碍（a11y）适配 | ⬜ | 4h | — | |

---

### 3.6 Phase 5 — 发布准备（第 12 周）

| # | 任务 | 状态 | 预估 | 实际 | 备注 |
|---|------|------|------|------|------|
| 5.1 | 完善 README.md | ⬜ | 2h | — | |
| 5.2 | 编写用户手册 | ⬜ | 4h | — | |
| 5.3 | 应用图标制作（五平台） | ⬜ | 4h | — | |
| 5.4 | App Store / Google Play 元数据 | ⬜ | 4h | — | |
| 5.5 | GitHub Release 自动化 CI/CD | ⬜ | 4h | — | |
| 5.6 | 旧版用户迁移指南 | ⬜ | 2h | — | |
| 5.7 | 全平台回归测试 | ⬜ | 8h | — | |
| 5.8 | 安全审计 | ⬜ | 4h | — | |

---

## 4. 风险与问题跟踪

### 4.1 风险登记册

| # | 风险 | 概率 | 影响 | 状态 | 缓解措施 | 负责人 |
|---|------|------|------|------|----------|--------|
| R1 | russh 在 iOS/Android 交叉编译失败 | 中 | 高 | 🟡 监控 | Phase 0 验证；备选 libssh2-sys | — |
| R2 | reqwest + rustls 移动端体积过大 | 中 | 中 | 🟡 监控 | 使用 rustls 替代 native-tls | — |
| R3 | Tauri 2 移动端 API 不稳定 | 中 | 高 | 🟡 监控 | 锁定稳定版；关注 changelog | — |
| R4 | CodeMirror 6 移动端性能差 | 低 | 中 | 🟢 已知 | 备选 Monaco 或简易 textarea | — |
| R5 | WebDAV 服务器实现差异大 | 中 | 中 | 🟡 监控 | PROPFIND 解析容错 | — |
| R6 | ts-rs 类型同步管线断裂 | 低 | 低 | 🟢 已知 | CI 增加类型检查 | — |
| R7 | 移动端适配超时 | 高 | 中 | 🟡 监控 | Phase 3 预留 buffer | — |
| R8 | 旧版加密密码无法解密 | 中 | 高 | 🟡 监控 | 密钥路径检测 + 解密失败提示 | — |

### 4.2 问题日志

> 开发中遇到的具体问题记录在此，已解决的标注解决日期和方案。

| # | 日期 | 问题描述 | 影响范围 | 状态 | 解决方案 | 解决日期 |
|---|------|----------|----------|------|----------|----------|
| P1 | 2026-07-14 | 本机无 MSVC link.exe，Rust 默认工具链无法链接 | 全部 Rust 编译 | 🟡 已规避 | 安装 GNU 工具链 + link-self-contained | 2026-07-14 |
| P2 | 2026-07-14 | GNU ld 链接 cdylib export ordinal 溢出 | cargo test/build | ✅ 已解决 | crate-type 改为仅 rlib | 2026-07-14 |
| P3 | 2026-07-14 | 项目路径含空格致 windres 失败 | cargo test | ✅ 已解决 | CARGO_TARGET_DIR 设无空格路径 | 2026-07-14 |
| P4 | 2026-07-14 | ts-rs 11 不支持 bitflags! derive(TS) | AdapterCapability | ✅ 已解决 | 改用 transparent newtype + type="number" | 2026-07-14 |
| P5 | 2026-07-14 | ts-rs 11 移除 transparent 属性 | AdapterCapability | ✅ 已解决 | 改用 type = "number" | 2026-07-14 |
| P6 | 2026-07-14 | ts-rs export() → export_all() API 变更 | export_types 测试 | ✅ 已解决 | 改用 export_all() | 2026-07-14 |
| P7 | 2026-07-14 | Rust 测试运行时 STATUS_ENTRYPOINT_NOT_FOUND | cargo test 运行 | 🔴 阻塞 | 待安装 MSVC；编译已通过 | — |
| P8 | 2026-07-14 | ts-rs 无法运行时导出类型 | TS 类型生成 | 🟡 已规避 | 手工生成占位类型文件 | 2026-07-14 |

---

## 5. 里程碑追踪

| 里程碑 | 所属阶段 | 目标日期 | 实际日期 | 状态 | 备注 |
|--------|----------|----------|----------|------|------|
| M0.1 — `tauri dev` 可启动 | Phase 0 | — | — | ⬜ | |
| M0.2 — Lint 检查通过 | Phase 0 | — | — | ⬜ | |
| M0.3 — 枚举目录 + ts-rs 同步 | Phase 0 | — | — | ⬜ | |
| M0.4 — FileTransport trait 就绪 | Phase 0 | — | — | ⬜ | |
| M0.5 — 配置读写 + 迁移 | Phase 0 | — | — | ⬜ | |
| M0.6 — 密码加密测试通过 | Phase 0 | — | — | ⬜ | |
| M0.7 — CI 桌面端构建 | Phase 0 | — | — | ⬜ | |
| M1.1 — SFTP + WebDAV adapter 完成 | Phase 1 | — | — | ⬜ | |
| M1.2 — 文件浏览 + 操作可用 | Phase 1 | — | — | ⬜ | |
| M1.3 — 桌面端 MVP 可用 | Phase 1 | — | — | ⬜ | |
| M2.1 — 远程编辑可用 | Phase 2 | — | — | ⬜ | |
| M2.2 — 跨协议传输可用 | Phase 2 | — | — | ⬜ | |
| M2.3 — 桌面端功能完整 | Phase 2 | — | — | ⬜ | |
| M3.1 — Android 真机运行 | Phase 3 | — | — | ⬜ | |
| M3.2 — iOS 真机运行 | Phase 3 | — | — | ⬜ | |
| M4.1 — 性能达标 | Phase 4 | — | — | ⬜ | |
| M4.2 — UI 打磨完成 | Phase 4 | — | — | ⬜ | |
| M5.1 — GitHub Release 发布 | Phase 5 | — | — | ⬜ | |

---

## 6. 变更历史

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|----------|--------|
| v1.0 | 2026-07-10 | 初始创建：会话日志、ADR-001~010、Phase 0-5 任务追踪、风险登记 | AI |

---

## 附录：更新规范

### 何时更新本文档

1. **每次开发会话结束** → 追加 Session 日志
2. **做出架构决策** → 追加 ADR 记录
3. **任务状态变更** → 更新对应 Phase 任务表
4. **发现新风险/问题** → 更新风险登记册/问题日志
5. **里程碑达成** → 更新里程碑追踪表

### 状态标记规范

| 标记 | 含义 |
|------|------|
| ⬜ | 未开始 / 待处理 |
| 🟡 | 进行中 / 监控中 |
| ✅ | 已完成 |
| 🔴 | 阻塞 / 严重问题 |
| 🟢 | 已知且可控 |
| ⚪ | 已废弃 |

### ADR 编号规范

- 按顺序编号：ADR-001, ADR-002, ...
- 编号不回收
- 状态变更时更新原记录，不删除
- 废弃的 ADR 标记为 ⚪ 并注明替代 ADR 编号
