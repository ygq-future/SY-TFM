# SY-TFM — 实现计划文档

**项目名称:** SY-TFM (Tiny File Manager)  
**日期:** 2026-07-05  
**状态:** Draft  

---

## 1. 实现概览

### 1.1 总体策略

采用**渐进式实现**策略，分 6 个阶段递进，每个阶段产出可运行的版本：

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
骨架搭建   桌面端MVP  功能补全   移动端适配  打磨优化   发布
```

### 1.2 时间估算

| 阶段 | 周数 | 核心产出 |
|------|------|----------|
| Phase 0 | 1 周 | 项目骨架 + Tauri 2 配置 + 枚举目录 + 代码规范 + CI |
| Phase 1 | 3 周 | 桌面端 MVP（FileTransport 架构 + SFTP/WebDAV adapter + 连接 + 浏览 + 基础操作） |
| Phase 2 | 3 周 | 桌面端功能补全（编辑 + 跨协议传输 + 设置） |
| Phase 3 | 2 周 | 移动端适配（iOS + Android） |
| Phase 4 | 2 周 | 性能优化 + UI 打磨 |
| Phase 5 | 1 周 | 发布准备 + 文档 |
| **合计** | **12 周** | |

---

## 2. Phase 0：项目骨架（第 1 周）

### 2.1 任务清单

| # | 任务 | 优先级 | 预估 | 依赖 |
|---|------|--------|------|------|
| 0.1 | 初始化 Tauri 2 + React + Vite 项目 | P0 | 2h | — |
| 0.2 | 配置 Tailwind CSS + shadcn/ui | P0 | 2h | 0.1 |
| 0.3 | 配置 TypeScript + ts-rs 类型生成管线 | P0 | 3h | 0.1 |
| 0.4 | **配置 ESLint + Prettier + prettier-plugin-tailwindcss** | P0 | 2h | 0.1 |
| 0.5 | **搭建全局枚举目录**（Rust `enums/` + TS `types/enums/`） | P0 | 4h | 0.3 |
| 0.6 | **定义 FileTransport trait + adapter 工厂骨架** | P0 | 4h | 0.5 |
| 0.7 | 搭建 Rust 后端模块骨架（commands/core/crypto/storage/models/transport） | P0 | 4h | 0.6 |
| 0.8 | 实现 AppSettings 配置读写 + 迁移逻辑（v1→v3） | P0 | 4h | 0.7 |
| 0.9 | 实现 SecretProtector 加密模块（AES-256-GCM + keyring） | P0 | 6h | 0.7 |
| 0.10 | 实现 i18next 国际化框架（EN + ZH） | P1 | 3h | 0.1 |
| 0.11 | 配置 GitHub Actions CI（桌面端构建） | P1 | 3h | 0.4 |
| 0.12 | 搭建响应式布局框架（桌面/平板/移动断点） | P1 | 4h | 0.2 |

### 2.2 里程碑

- ✅ `bun run tauri dev` 可启动空白应用
- ✅ ESLint + Prettier 代码检查通过
- ✅ 全局枚举目录建立，ts-rs 类型同步正常
- ✅ FileTransport trait 定义完成，adapter 工厂骨架就绪
- ✅ 配置文件读写正常，旧配置可迁移
- ✅ 密码加解密单元测试通过
- ✅ CI 自动构建桌面端产物

### 2.3 关键实现细节

#### 代码规范配置

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

```json
// package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "types:export": "cargo test --test export_types --manifest-path src-tauri/Cargo.toml"
  }
}
```

#### ts-rs 类型同步管线

```
Rust struct/enum (#[derive(TS)])
    │
    ▼  cargo test (ts-rs 在 test 阶段导出)
src/types/enums/*.ts + src/types/generated/*.ts
    │
    ▼  TypeScript 编译器检查
前端代码使用类型安全的 invoke
```

```toml
# Cargo.toml
[dev-dependencies]
ts-rs = { version = "10", features = ["export-to-struct"] }

[[test]]
name = "export_types"
path = "tests/export_types.rs"
```

```rust
// tests/export_types.rs
use sy_tfm::enums::*;
use sy_tfm::models::*;

#[test]
fn export_all_types() {
    Protocol::export().unwrap();
    ConnectionStatus::export().unwrap();
    Theme::export().unwrap();
    Language::export().unwrap();
    SortColumn::export().unwrap();
    SortOrder::export().unwrap();
    ErrorCode::export().unwrap();
    FileOperation::export().unwrap();
    EditMode::export().unwrap();
    Platform::export().unwrap();
    TransferDirection::export().unwrap();
    AdapterCapability::export().unwrap();
    RemoteHost::export().unwrap();
    RemoteFile::export().unwrap();
    AppSettings::export().unwrap();
}
```

---

## 3. Phase 1：桌面端 MVP（第 2-4 周）

### 3.1 目标

实现桌面端核心功能：FileTransport 架构落地 + SFTP/WebDAV 双 adapter + 连接 + 浏览 + 文件操作。

### 3.2 任务清单

#### 第 2 周：FileTransport 架构 + Adapter 实现 + 连接管理

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 1.1 | **实现 SftpAdapter（russh）— 完整 FileTransport trait** | 0.6 | 12h |
| 1.2 | **实现 WebDavAdapter（reqwest）— 完整 FileTransport trait** | 0.6 | 12h |
| 1.3 | 实现 WebDAV PROPFIND XML 解析（quick-xml） | 1.2 | 4h |
| 1.4 | 实现 SessionManager（会话增删查改，trait 对象调度） | 1.1, 1.2 | 4h |
| 1.5 | 实现 connection 命令层（connect/disconnect/status/capabilities） | 1.4 | 4h |
| 1.6 | 实现密码提示对话框（前端组件） | 0.10 | 3h |
| 1.7 | 实现 HostList + HostCard 组件（含协议图标） | 1.5, 1.6 | 6h |
| 1.8 | 实现 HostEditDialog（新建/编辑/克隆，协议选择器） | 1.7 | 4h |
| 1.9 | 实现 get_supported_protocols 命令 | 0.5 | 2h |

#### 第 3 周：文件浏览 + 操作

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 1.10 | 实现 list_directory + navigate 命令（通过 trait 调度） | 1.4 | 4h |
| 1.11 | 实现 FileList 组件（虚拟列表 + 能力驱动列显示） | 1.10 | 8h |
| 1.12 | 实现 Breadcrumb 面包屑路径栏 | 1.11 | 6h |
| 1.13 | 实现 download/upload 命令 + 进度事件 | 1.4 | 8h |
| 1.14 | 实现 delete/create/move/rename 命令 | 1.4 | 4h |
| 1.15 | 实现 DownloadBar 进度条组件 | 1.13 | 4h |
| 1.16 | 实现 UploadZone 拖拽上传（dnd-kit） | 1.13 | 6h |
| 1.17 | 实现 ConfirmDialog + InputDialog | 0.10 | 3h |
| 1.18 | 实现 ContextMenu 右键菜单 | 1.14, 1.17 | 4h |
| 1.19 | 实现文件列表排序（多列 + 升降序，使用 SortColumn 枚举） | 1.11 | 4h |
| 1.20 | 实现 FileIcon 图标映射（150+ 类型） | — | 4h |

#### 第 4 周：状态管理 + 错误处理 + 测试

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 1.21 | 实现橡皮筋多选（桌面端） | 1.11 | 6h |
| 1.22 | 实现拖拽移动文件 | 1.14, 1.21 | 4h |
| 1.23 | 实现 Zustand stores（connection/browser/settings） | — | 6h |
| 1.24 | 实现 TanStack Query 集成（缓存 + 重试） | 1.23 | 4h |
| 1.25 | 实现统一错误处理中间件（ErrorCode 枚举驱动） | — | 4h |
| 1.26 | 实现 Toast 通知系统（sonner） | — | 2h |
| 1.27 | 实现 KeepAlive + 断连重连逻辑 | 1.4 | 6h |
| 1.28 | 编写 Rust 单元测试（adapter + 核心服务） | 1.1-1.4 | 8h |
| 1.29 | 编写前端组件测试（Vitest） | 1.23 | 4h |
| 1.30 | 桌面端 MVP 集成测试 | 全部 | 4h |

### 3.3 里程碑

- ✅ SftpAdapter 完整实现 FileTransport trait，可连接 SFTP 服务器
- ✅ WebDavAdapter 完整实现 FileTransport trait，可连接 WebDAV 服务器
- ✅ 可通过 SFTP/WebDAV 协议浏览目录
- ✅ 可上传/下载/删除/重命名/移动文件
- ✅ 多主机并行连接（支持不同协议混合）
- ✅ adapter 能力驱动 UI（WebDAV 隐藏 owner/permissions 列）
- ✅ 密码加密存储
- ✅ 拖拽上传和移动
- ✅ 中英文切换

### 3.4 Adapter 实现验证

| 验证项 | SftpAdapter | WebDavAdapter |
|--------|-------------|---------------|
| connect() | SSH 握手 + SFTP channel | HTTP Basic Auth + PROPFIND 验证 |
| list_directory() | readdir | PROPFIND Depth:1 |
| download_file() | read file | GET |
| upload_file() | write file | PUT |
| delete_file() | remove file | DELETE |
| delete_directory() | rmdir (递归) | DELETE (递归) |
| create_directory() | mkdir | MKCOL |
| move_file() | rename | MOVE |
| get_working_dir() | realpath | 当前记录 |
| is_connected() | session check | client check |
| capabilities() | OWNER_PERMISSIONS \| SYMLINKS \| ATOMIC_RENAME | NONE |

---

## 4. Phase 2：桌面端功能补全（第 5-7 周）

### 4.1 任务清单

#### 第 5 周：远程编辑

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 2.1 | 实现 FileWatcher 服务（notify crate） | 1.4 | 6h |
| 2.2 | 实现 edit_remote_external 命令 | 2.1 | 6h |
| 2.3 | 实现 EditSessionManager（会话管理 + 失效机制） | 2.2 | 4h |
| 2.4 | 实现 OnlineEditor 组件（CodeMirror 6） | — | 8h |
| 2.5 | 实现编辑器工具栏（保存/语法选择） | 2.4 | 4h |
| 2.6 | 实现语法高亮自动检测（TextMate grammars） | 2.4 | 4h |
| 2.7 | 实现 editor:synced/error 事件处理 | 2.3 | 3h |

#### 第 6 周：跨协议传输 + 设置面板

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 2.8 | **实现 transfer 命令（跨协议传输，本地中转）** | 1.4 | 8h |
| 2.9 | 实现 TransferBrowserDialog 组件 | 2.8 | 8h |
| 2.10 | 实现传输面板独立连接状态管理 | 2.9 | 4h |
| 2.11 | 实现 SettingsWindow 设置面板 | — | 8h |
| 2.12 | 实现主题切换（亮/暗/跟随系统，Theme 枚举） | 2.11 | 4h |
| 2.13 | 实现强调色选择器（18 预设 + 自定义） | 2.11 | 4h |
| 2.14 | 实现背景图片设置（桌面端） | 2.11 | 4h |
| 2.15 | 实现"关于"信息面板 | 2.11 | 2h |

#### 第 7 周：配置管理 + 高级功能

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 2.16 | 实现配置导出/导入（HostDto） | 0.8 | 4h |
| 2.17 | 实现配置备份与恢复 | 2.16 | 4h |
| 2.18 | 实现标签筛选主机列表 | 1.7 | 3h |
| 2.19 | 实现下载路径三级解析 | 0.8 | 2h |
| 2.20 | 实现路径栏就地编辑 | 1.12 | 3h |
| 2.21 | 实现复制路径 toast | 1.12 | 2h |
| 2.22 | 实现窗口置顶（桌面端） | — | 2h |
| 2.23 | 实现自定义标题栏（ExtendClientArea） | — | 6h |
| 2.24 | 实现错误 overlay 自动消失 | 1.25 | 2h |

### 4.2 里程碑

- ✅ 远程编辑（外部 + 内置）功能完整
- ✅ **跨协议传输正常工作（SFTP ↔ WebDAV）**
- ✅ 设置面板功能完整
- ✅ 配置导入/导出/备份正常
- ✅ 桌面端功能完整

---

## 5. Phase 3：移动端适配（第 8-9 周）

### 5.1 任务清单

#### 第 8 周：iOS/Android 基础适配

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 3.1 | 初始化 Tauri Android 项目 | 0.1 | 4h |
| 3.2 | 初始化 Tauri iOS 项目 | 0.1 | 4h |
| 3.3 | 验证 russh + reqwest 在移动端交叉编译 | 0.6 | 6h |
| 3.4 | 实现移动端密钥存储（Keychain/Keystore） | 0.9 | 6h |
| 3.5 | 实现移动端文件系统适配（下载路径） | 0.8 | 4h |
| 3.6 | 实现 ResponsiveLayout 响应式布局 | 0.12 | 6h |
| 3.7 | 实现 MobileTabBar 底部导航 | 3.6 | 4h |
| 3.8 | 实现 Drawer 侧栏抽屉（移动端） | 3.7 | 4h |
| 3.9 | 实现移动端文件列表（Card 样式） | 3.6 | 6h |
| 3.10 | 实现滑动操作（左滑删除/右滑更多） | 3.9 | 6h |
| 3.11 | 实现长按多选模式 | 3.9 | 4h |

#### 第 9 周：移动端功能完善

| # | 任务 | 依赖 | 预估 |
|---|------|------|------|
| 3.12 | 实现下拉刷新 | 3.9 | 3h |
| 3.13 | 实现双指缩放（字体大小） | 3.9 | 3h |
| 3.14 | 实现 Haptic 振动反馈 | — | 2h |
| 3.15 | 实现移动端上传（系统文件选择器） | 3.5 | 4h |
| 3.16 | 实现移动端编辑器（虚拟键盘适配） | 2.4 | 6h |
| 3.17 | 实现移动端 BottomSheet 上下文菜单 | 3.9 | 4h |
| 3.18 | 实现后台连接管理（30s 超时断开） | — | 4h |
| 3.19 | 实现网络切换检测与提示 | 3.18 | 4h |
| 3.20 | 实现移动端分享文件（Share API） | — | 3h |
| 3.21 | iOS/Android 真机测试 | 全部 | 8h |

### 5.2 里程碑

- ✅ Android APK 可在真机运行
- ✅ iOS IPA 可在真机运行
- ✅ SFTP + WebDAV 均可在移动端连接
- ✅ 移动端核心功能正常（连接/浏览/编辑/下载）
- ✅ 触摸交互流畅
- ✅ 后台/前台切换连接管理正常

### 5.3 移动端关键挑战与对策

| 挑战 | 对策 |
|------|------|
| russh 在 iOS/Android 交叉编译 | Phase 0 验证；备选：SSH 库换 `libssh2-sys`（C 绑定） |
| reqwest TLS 在移动端 | 使用 `rustls` feature 避免 OpenSSL 依赖 |
| iOS 后台连接限制 | 进入后台 30s 后主动断开，回前台自动重连 |
| Android 权限申请 | 使用 Tauri 权限系统，运行时动态申请 |
| 移动端键盘遮挡 | 使用 `viewport` 事件 + `VisualViewport` API |
| 大列表性能 | 使用 `@tanstack/react-virtual` 虚拟列表 |

---

## 6. Phase 4：性能优化与 UI 打磨（第 10-11 周）

### 6.1 任务清单

#### 第 10 周：性能优化

| # | 任务 | 预估 |
|---|------|------|
| 4.1 | 虚拟列表优化（千文件场景） | 6h |
| 4.2 | 目录列表缓存（TanStack Query staleTime） | 4h |
| 4.3 | 文件图标懒加载 + 缓存 | 3h |
| 4.4 | Rust 端连接池优化（避免重复握手） | 4h |
| 4.5 | 大文件下载分块传输 + 断点续传 | 8h |
| 4.6 | 前端 Bundle 体积分析 + 代码分割 | 4h |
| 4.7 | Rust 编译体积优化（strip + LTO） | 3h |
| 4.8 | 内存泄漏排查（长时间连接场景） | 6h |

#### 第 11 周：UI 打磨

| # | 任务 | 预估 |
|---|------|------|
| 4.9 | 主题色板完善（暗色模式对比度） | 4h |
| 4.10 | 过渡动画（BrushTransition 等效） | 4h |
| 4.11 | 桌面端自定义标题栏完善 | 4h |
| 4.12 | 移动端手势动画优化 | 6h |
| 4.13 | 空状态设计（无主机/无文件） | 3h |
| 4.14 | 加载骨架屏（Skeleton） | 3h |
| 4.15 | 错误状态 UI 设计 | 3h |
| 4.16 | 五平台 UI 一致性走查 | 6h |
| 4.17 | 无障碍（a11y）适配 | 4h |

### 6.2 里程碑

- ✅ 千文件列表 < 500ms
- ✅ 冷启动 < 2s（桌面） / < 3s（移动）
- ✅ 内存占用 < 150MB（桌面） / < 100MB（移动）
- ✅ 安装包 < 15MB（桌面） / < 25MB（移动）
- ✅ 五平台 UI 无错位

---

## 7. Phase 5：发布准备（第 12 周）

### 7.1 任务清单

| # | 任务 | 预估 |
|---|------|------|
| 5.1 | 完善 README.md | 2h |
| 5.2 | 编写用户手册 | 4h |
| 5.3 | 应用图标制作（五平台） | 4h |
| 5.4 | App Store / Google Play 元数据准备 | 4h |
| 5.5 | GitHub Release 自动化 CI/CD | 4h |
| 5.6 | 旧版用户迁移指南 | 2h |
| 5.7 | 全平台回归测试 | 8h |
| 5.8 | 安全审计（密码加密、权限） | 4h |

### 7.2 里程碑

- ✅ GitHub Release 发布五平台安装包
- ✅ 文档完整
- ✅ 安全审计通过

---

## 8. 风险分析

### 8.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| russh 在 iOS/Android 交叉编译失败 | 中 | 高 | Phase 0 验证；备选：`libssh2-sys`（C 绑定） |
| reqwest + rustls 在移动端体积过大 | 中 | 中 | 使用 `rustls` 替代 `native-tls`；裁剪未用 feature |
| Tauri 2 移动端 API 不稳定 | 中 | 高 | 锁定 Tauri 2.x 稳定版；关注 changelog |
| CodeMirror 6 移动端性能差 | 低 | 中 | 备选：Monaco Editor 或简易 textarea |
| WebDAV 服务器实现差异大 | 中 | 中 | PROPFIND 响应解析容错；测试主流服务器（Nextcloud/ownCloud/Apache） |
| ts-rs 类型同步管线断裂 | 低 | 低 | CI 中增加类型检查步骤 |

### 8.2 进度风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 移动端适配超时 | 高 | 中 | Phase 3 预留 buffer；核心功能优先，非核心降级 |
| 性能优化无止境 | 中 | 低 | 设定量化目标，达标即止 |
| 五平台测试覆盖不足 | 高 | 中 | 优先桌面端 + Android，iOS 最后覆盖 |

### 8.3 兼容性风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 旧版加密密码无法解密 | 中 | 高 | 密钥文件路径自动检测；解密失败提示重输 |
| 旧版配置字段缺失 | 低 | 低 | serde default 兜底 |
| WebDAV 服务器非标实现 | 中 | 中 | 异常处理 + XML 解析 fallback |

---

## 9. 测试策略

### 9.1 测试金字塔

```
          /\
         /  \      E2E 测试 (Tauri WebDriver, 少量关键路径)
        /----\
       /      \    集成测试 (Rust + Tauri mock, 核心流程)
      /--------\
     /          \  单元测试 (Rust cargo test + Vitest, 大量)
    /____________\
```

### 9.2 测试覆盖目标

| 层级 | 工具 | 覆盖率目标 | 重点 |
|------|------|-----------|------|
| Rust 单元测试 | `cargo test` | > 80% | 加密、配置迁移、adapter 逻辑 |
| 前端单元测试 | Vitest + Testing Library | > 70% | 组件渲染、Store 逻辑 |
| 集成测试 | Tauri mock | 关键路径 | 连接→浏览→操作→断开（SFTP + WebDAV） |
| E2E 测试 | Tauri WebDriver | 5 条核心路径 | 连接、上传、下载、编辑、跨协议传输 |

### 9.3 Adapter 测试矩阵

| 测试项 | SftpAdapter | WebDavAdapter |
|--------|-------------|---------------|
| 连接成功 | ✅ | ✅ |
| 连接失败（错误密码） | ✅ | ✅ |
| 列出目录 | ✅ | ✅ |
| 下载文件 | ✅ | ✅ |
| 上传文件 | ✅ | ✅ |
| 删除文件 | ✅ | ✅ |
| 创建目录 | ✅ | ✅ |
| 移动/重命名 | ✅ | ✅ |
| 断连重连 | ✅ | ✅ |
| 能力声明 | ✅ | ✅ |

### 9.4 E2E 测试用例

| # | 场景 | 步骤 |
|---|------|------|
| E1 | SFTP 连接 + 浏览 | 添加 SFTP 主机 → 连接 → 验证目录列表 → 断开 |
| E2 | WebDAV 连接 + 浏览 | 添加 WebDAV 主机 → 连接 → 验证目录列表 → 断开 |
| E3 | 文件下载 | 连接 → 选中文件 → 下载 → 验证本地文件存在 |
| E4 | 文件上传 | 连接 → 拖拽上传 → 验证远程文件出现 |
| E5 | 跨协议传输 | 连接 SFTP + WebDAV → 传输文件 → 验证目标主机文件出现 |

---

## 10. CI/CD 流水线

### 10.1 GitHub Actions 矩阵

```yaml
strategy:
  matrix:
    include:
      - platform: ubuntu-22.04
        target: x86_64-unknown-linux-gnu
      - platform: windows-latest
        target: x86_64-pc-windows-msvc
      - platform: macos-latest
        target: aarch64-apple-darwin
      - platform: macos-latest
        target: x86_64-apple-darwin
      - platform: ubuntu-22.04
        target: aarch64-linux-android
      - platform: macos-latest
        target: aarch64-apple-ios
```

### 10.2 流水线阶段

```
Push/PR ──► Lint (cargo clippy + eslint + prettier --check)
         ──► Type Check (tsc + ts-rs export)
         ──► Unit Test (cargo test + vitest)
         ──► Build (tauri build)
         ──► Artifact Upload

Tag v* ──► All above
       ──► E2E Test
       ──► Sign & Notarize (macOS/iOS)
       ──► GitHub Release
       ──► Play Store Upload (Android)
       ──► App Store Upload (iOS)
```

---

## 11. 依赖关系图

```
Phase 0 (骨架)
  ├── 0.1-0.4: 项目初始化 + 代码规范
  ├── 0.5: 全局枚举目录 ──────────────────┐
  ├── 0.6: FileTransport trait ───────────┤
  ├── 0.7-0.9: Rust 后端骨架 + 加密      │
  └── 0.10-0.12: 前端框架 + CI           │
        │                                  │
        ▼                                  │
Phase 1 (桌面 MVP)                         │
  ├── 1.1-1.2: SftpAdapter + WebDavAdapter ◄┘
  ├── 1.3-1.4: XML 解析 + SessionManager
  ├── 1.5-1.9: 命令层 → 主机管理 UI
  ├── 1.10-1.12: 浏览命令 → 文件列表 UI
  ├── 1.13-1.22: 文件操作 → 拖拽/多选 UI
  └── 1.23-1.30: 状态管理 → 测试
        │
        ▼
Phase 2 (功能补全)
  ├── 2.1-2.7: FileWatcher → 编辑器
  ├── 2.8-2.10: 跨协议传输 → 传输面板
  └── 2.11-2.24: 设置 → 高级功能
        │
        ▼
Phase 3 (移动端) ← 可与 Phase 2 部分并行
  ├── 3.1-3.5: 平台初始化 → 移动端适配
  ├── 3.6-3.11: 响应式布局 → 触摸交互
  └── 3.12-3.21: 移动端功能完善
        │
        ▼
Phase 4 (优化)
  ├── 4.1-4.8: 性能优化
  └── 4.9-4.17: UI 打磨
        │
        ▼
Phase 5 (发布)
```

---

## 12. 验收检查清单

### 12.1 架构验收

- [ ] FileTransport trait 定义完整，所有方法有文档
- [ ] SftpAdapter 完整实现 FileTransport trait
- [ ] WebDavAdapter 完整实现 FileTransport trait
- [ ] 新增 adapter 仅需实现 trait + 注册枚举，零修改上层代码
- [ ] 全局枚举目录建立，所有常量通过枚举引用，无魔法字符串
- [ ] 枚举类型 Rust→TypeScript 自动同步管线工作正常
- [ ] Adapter 能力声明驱动 UI 列显示
- [ ] ESLint + Prettier 代码检查通过
- [ ] 跨协议传输（SFTP ↔ WebDAV）正常

### 12.2 功能验收

- [ ] SFTP 协议连接、浏览、文件操作正常
- [ ] WebDAV 协议连接、浏览、文件操作正常
- [ ] 多主机并行连接（混合协议）
- [ ] 密码加密存储（五平台）
- [ ] 临时密码输入（未保存密码时）
- [ ] 目录列表 + 排序 + 图标
- [ ] 面包屑路径栏（折叠/编辑/复制）
- [ ] 下载（单文件/多文件/目录递归）
- [ ] 上传（拖拽/目录递归）
- [ ] 删除（单/多 + 确认）
- [ ] 重命名
- [ ] 移动（拖拽）
- [ ] 新建文件/文件夹
- [ ] 远程编辑（外部编辑器 + FileWatcher）
- [ ] 在线编辑（CodeMirror + 语法高亮）
- [ ] 跨主机传输（跨协议）
- [ ] 设置面板（通用/外观/路径/关于）
- [ ] 主题切换（亮/暗/系统）
- [ ] 强调色选择
- [ ] 背景图片（桌面端）
- [ ] 国际化（EN/ZH）
- [ ] 配置导入/导出
- [ ] 旧配置迁移

### 12.3 移动端验收

- [ ] Android APK 真机运行
- [ ] iOS IPA 真机运行
- [ ] 响应式布局正确
- [ ] 底部 Tab 导航
- [ ] 滑动操作
- [ ] 长按多选
- [ ] 下拉刷新
- [ ] 移动端文件选择器
- [ ] 虚拟键盘适配
- [ ] 后台连接管理
- [ ] 网络切换提示

### 12.4 非功能验收

- [ ] 冷启动 < 2s（桌面） / < 3s（移动）
- [ ] 千文件列表 < 500ms
- [ ] 内存 < 150MB（桌面） / < 100MB（移动）
- [ ] 安装包 < 15MB（桌面） / < 25MB（移动）
- [ ] Rust 单元测试覆盖率 > 80%
- [ ] 前端单元测试覆盖率 > 70%
- [ ] E2E 测试 5 条路径通过
- [ ] 无 P0 级 Bug

---

## 13. 后续迭代计划（不在首版范围）

| 协议 | Adapter | 依赖库 | 优先级 | 预估 |
|------|---------|--------|--------|------|
| FTP/FTPS | FtpAdapter | suppaftp | P1 | 2 周 |
| Amazon S3 | S3Adapter | aws-sdk-s3 | P2 | 2 周 |
| SCP | ScpAdapter | russh | P3 | 1 周 |

> 新增 adapter 的步骤（零修改上层代码）：
> 1. 在 `src-tauri/src/transport/` 新建 `xxx_adapter.rs`
> 2. 实现 `FileTransport` trait 所有方法
> 3. 在 `Protocol` 枚举添加变体
> 4. 在 `create_adapter()` 工厂函数注册
> 5. 运行 `cargo test --test export_types` 同步 TypeScript 类型
> 6. 完成。上层代码、UI、命令层无需任何修改。
