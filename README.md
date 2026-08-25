# SY-TFM

SY-TFM（Tiny File Manager）是一款基于 Tauri 2、React 和 Rust 的轻量级远程文件管理器，面向 Windows 桌面和 Android 移动设备。它把不同文件传输协议统一到同一套文件浏览与操作界面中，适合管理服务器、NAS 和 WebDAV 存储。

## 当前版本

当前发布版本为 **v1.0.0**，提供以下平台构建：

| 平台 | 架构 | 最低版本 | 发布文件 |
| --- | --- | --- | --- |
| Windows | x64 | Windows 10 1809 | EXE、portable ZIP |
| Android | ARM64 | Android 12 / API 31 | APK |

前往 [GitHub Releases](https://github.com/ygq-future/SY-TFM/releases) 下载最新构建。

## 功能特性

- 支持 SFTP 与 WebDAV 远程连接
- 双面板文件浏览、路径导航、排序和协议能力感知的文件信息列
- 上传、下载、递归目录传输、删除、重命名、新建和移动
- 跨主机文件传输与整体进度显示
- 按主机保存收藏文件夹，并通过加密 Vault 同步主机共享数据
- Remote Edit：使用系统编辑器编辑远程文件并监听本地变化
- Online Edit：支持语法高亮、查找替换、自动换行和远程版本冲突保护
- Windows 使用独立编辑器窗口，支持多文件同时编辑且不阻塞主面板；Android 使用嵌入式编辑器
- Windows 与 Android 的主题、背景和触摸/窗口交互适配
- 凭据使用平台安全存储，敏感配置采用 AES-256-GCM 保护

## 安装与使用

### Windows

下载 `SY-TFM-windows-x64.exe` 后直接运行，或解压 `SY-TFM-windows-portable.zip` 使用便携版。首次使用时添加 SFTP 或 WebDAV 主机，然后即可浏览远程目录。

### Android

下载 ARM64 APK 并安装。应用最低支持 Android 12（API 31）；上传文件使用系统文件选择器，下载内容可保存到公共 Downloads 目录。

## 开发环境

项目使用 Bun 管理前端依赖，后端由 Rust 编译。桌面开发需要 Rust、Bun 和 Tauri 依赖；Android 构建还需要 Android SDK、NDK 及 Java/Gradle 环境。

```bash
bun install
bun run tauri dev
```

常用构建命令：

```bash
# Windows 构建
bun run tauri build

# Windows portable 包
bun run portable:build

# Android ARM64 APK
bun run tauri android build --target aarch64 --apk --ci
```

提交改动前运行质量检查：

```bash
bun lint
bun format
bun test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

## 项目结构

```text
src/                 React 前端、页面、功能模块和状态管理
src-tauri/src/       Rust 后端、Tauri commands、会话与传输适配器
src-tauri/gen/       Tauri Android 工程
docs/                需求、架构、接口、数据模型和进度记录
scripts/             构建与安装包辅助脚本
```

后端通过 `FileTransport` trait 隔离协议实现，上层业务不直接依赖具体协议库。详细设计和接口约束见 [`docs/`](./docs/) 与 [`AGENTS.md`](./AGENTS.md)。

## 许可证

本项目使用 [MIT License](./LICENSE)。
