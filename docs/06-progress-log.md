# SY-TFM — 实时进度与决策日志

**项目名称:** SY-TFM (Tiny File Manager)  
**创建日期:** 2026-07-10  
**最后更新:** 2026-07-19
**当前阶段:** Phase 2 已完成 — Windows 桌面基线 v1.0.0

> **使用说明:** 本文档是项目的活文档（living document），每次开发会话结束后更新。  
> 顶部是快速概览，往下是详细记录。最新的内容在最上面。

---

## 0. 快速概览

### 0.1 当前状态

| 指标 | 值 |
|------|-----|
| 当前阶段 | Phase 0/1/2 已完成；下一阶段为 Phase 3 移动端适配 |
| 当前任务 | 完成 Windows 便携版与 NSIS 分发基础，准备真实服务端与安装包人工验收 |
| 总体进度 | 文档设计 100%，Phase 0/1 完成，Phase 2 为 22/22（2 项由新版交互取代） |
| 阻塞项 | 无；MSVC 编译、测试与 ts-rs 导出均已恢复 |
| 文档状态 | ✅ 需求 ✅ 架构 ✅ 接口 ✅ 数据模型 ✅ 实现计划 ✅ 进度日志 |

### 0.2 当前在做

> Windows 桌面核心功能、便携运行时、NSIS 安装器视觉资源与加密保险库已就位；下一步进入真实服务端、安装/卸载与长时间稳定性验收。

### 0.3 下一步计划

1. **真实服务器兼容性矩阵** — 补充不同 SFTP/WebDAV 服务端、DPI 与外部编辑器人工验收
2. **启动 Phase 3** — Android/iOS 工程初始化、响应式壳层与平台文件选择策略
3. **发布准备** — 完善用户文档、CI/CD、签名与安全审计

### 0.4 阶段进度仪表盘

| 阶段 | 状态 | 任务完成 | 里程碑 | 备注 |
|------|------|---------|--------|------|
| Phase 0 — 项目骨架 | ✅ 已完成 | 12/12 | 7/7 | 类型导出与 Rust 测试已恢复 |
| Phase 1 — 桌面端 MVP | ✅ 已完成 | 30/30 | 3/3 | 完整协议 feature、前端构建与自动化测试通过 |
| Phase 2 — 功能补全 | ✅ 已完成 | 22/22 | 3/3 | Windows 桌面 v1.0.0 自动化基线完成 |
| Phase 3 — 移动端适配 | ⬜ 未启动 | 0/21 | 0/6 | |
| Phase 4 — 优化打磨 | ⬜ 未启动 | 0/17 | 0/5 | |
| Phase 5 — 发布准备 | 🟡 进行中 | 1/8 | 0/3 | 五平台图标资源已生成 |

> **图例:** ⬜ 未启动 / 🟡 进行中 / ✅ 已完成 / 🔴 阻塞

---

## 1. 会话日志

> 每次开发会话在此追加记录，最新在最上面。

### Session #050 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | 备份密码可视确认与桌面单实例 |
| **参与者** | 用户 + AI |

**完成事项:**

- 保存备份密码前始终显示最终确认弹窗，以原始等宽文本、字符数和空白字符数明确展示本次保存值
- 普通空格、Tab 与不换行空格使用独立可视标记；检测到首尾空白时追加高风险提示，同时明确实际密码不会被规范化或写入日志
- 桌面端接入官方 `tauri-plugin-single-instance`，并确保它先于其他插件注册；重复启动会还原、显示并聚焦既有主窗口
- single-instance 依赖仅面向 Windows/macOS/Linux，保持移动端构建边界不变，并同步依赖基线文档

**验证:**

- 单实例实机冒烟：第二个 EXE 进程在 3 秒内退出，同路径存活实例数始终为 1
- `bun run lint`、`bun run format`、Vitest 26 文件 / 130 测试通过
- `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings` 通过

### Session #049 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | WebDAV 保险库恢复密码诊断 |
| **参与者** | 用户 + AI |

**诊断结论:**

- 对安装版本机元数据与云端 `sy-tfm-vault.sytfm` 做只读比对：revision 均为 6，Vault ID 与 key envelope 完全一致
- 安装版设备加密保存的备份密码可同时解开本地信封和云端信封；缓存 Vault Key 也可解密云端载荷，排除云端文件损坏、上传截断和信封不同步
- 恢复接口对前端输入不执行 trim、编码替换或大小写转换；当前错误发生在 Argon2id 派生密钥解开云端信封时，说明便携版实际提交的密码字节与云端密码不一致
- 诊断过程仅输出 revision 与布尔比对结果，未记录或显示 WebDAV 密码、备份密码、Vault Key 或服务器地址

### Session #048 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Windows 便携分发与 NSIS 安装器视觉配置 |
| **参与者** | 用户 + AI |

**完成事项:**

- 新增 `SY-TFM.portable` 同级标记：存在时配置固定写入 EXE 旁 `data/`，不会读取或写入安装版默认 AppData 路径
- 便携模式不改变 Windows Credential Manager 的设备级保护；跨设备主机密码仍由已有加密保险库导出/恢复，避免将密钥明文放入 ZIP
- 设置页展示便携模式数据目录并锁定其路径选择，避免用户在便携副本中意外分流数据
- 新增 `bun run portable:build`：生成包含 EXE、便携标记与恢复说明的 Windows ZIP
- 便携产物统一输出到 `src-tauri/target/release/bundle/portable/`，并改由 Tauri CLI 的生产构建链生成，确保内嵌前端资源与 custom protocol 一致
- 新增可复现的 NSIS 位图生成脚本，并使用应用图标构建深色橙色 Header/Sidebar、安装/卸载图标、中英文语言选择和 LZMA 压缩配置
- StoragePaths 增加 `portableMode`，完成 ts-rs 前端类型同步
- 修复隐藏窗口启动死锁：隐藏 WebView 不稳定派发 `requestAnimationFrame`，原有“两帧后 show”无法执行；现在 React 挂载后立即调用原生 `show()`，没有定时等待

**验证:**

- 便携标记路径 Rust 单元测试通过
- 发布便携 EXE 主窗口冒烟通过：主窗口约 455ms 可见，标题与窗口句柄正常，不再残留后台无界面进程
- `bun run types:export`、窗口配置回归测试、便携路径测试与默认发布特性的 `cargo clippy --all-targets -- -D warnings` 通过
- `bun run lint`、`bun run format`、Vitest 25 文件 / 127 测试通过

### Session #047 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | 全局状态栏布局与断连残留修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 修复文件统计从 `items` 切换为 `selected` 后发生换行的问题，避免状态栏高度异常并挤压 Vault 状态
- 为文件统计增加固定单行布局；Vault 状态允许优先压缩状态文字，同时保留最近同步时间的完整显示空间
- 修正 Vault 容器的 flex 增长策略：没有文件统计时按内容整体右对齐，出现较长的选中统计时才向左收缩
- 增加状态栏布局回归断言，覆盖文件统计与 Vault 时间的 flex 约束
- 修复断开主机后浏览器 store 仍保留旧目录数据、状态栏继续显示旧 `items` 数量的问题
- 断连时重置对应 pane 的目录缓存；状态栏仅为当前仍有效的连接显示文件统计

**验证:**

- `bun run lint`、`bun run format`、Vitest 25 文件 / 126 测试通过

### Session #046 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | 嵌套弹窗层级与云端覆盖确认修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位设置面板 `z-index: 240` 高于通用弹窗 `z-index: 60` 的根因，为全局 Dialog 增加独立高层级，确保二次确认始终覆盖设置面板
- “开启并上传”检测到云端已有保险库时改为弹出覆盖确认，不再要求强制从云端恢复
- 后端新增显式 `overwriteExisting` 授权，默认仍拒绝覆盖；仅在用户确认后覆盖 WebDAV 的旧保险库
- 增加中英文覆盖风险文案及 Dialog 层级、前端确认流程、后端覆盖保护的回归测试
- 同步更新 `enable_vault_sync` 接口文档

**验证:**

- `bun run lint`、`bun run format`、Vitest 25 文件 / 123 测试与 Vite 生产构建通过
- Rust 99 项库测试、全特性 Clippy（`-D warnings`）、`cargo fmt --check` 与 `git diff --check` 通过
- 默认 Cargo target 被运行中的 `sy-tfm.exe` 锁定，Rust 测试和 Clippy 已改用独立临时 target 完成验证

### Session #045 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | 备份密码设置卡片纵向布局统一 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将备份密码设置改为与 WebDAV 同步卡一致的信息层级，标题和用途说明独占顶部整行
- 恢复 Password 与 Confirm password 的可见字段标签，两项输入框位于内容区下一行
- Save 操作移至卡片底部右侧，并在窄窗口下保持输入框堆叠和操作区稳定对齐
- 当后端确认 Windows 已保存共用备份密码时，在底部左侧显示持久化状态，避免密码框不回显造成状态不明确
- 更新布局契约测试，约束凭据卡使用单列信息区以及底部右对齐的保存操作

**验证:**

- `bun run lint`、`bun run format`、Vitest 25 文件 / 122 测试、Vite 生产构建与 `git diff --check` 通过

### Session #044 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | 备份密码凭据行响应式重设计 |
| **参与者** | 用户 + AI |

**完成事项:**

- 移除导致 Save 溢出卡片的 `430px` 控制区硬最小宽度，父子 Grid 均改用可收缩的 `minmax(0, …)` 列
- 去掉输入框上方重复的可见标签，改用简洁 placeholder，并保留屏幕阅读器标签和 `aria-label`
- Password、Confirm password 与紧凑 Save 按钮改为等高单行；窄视口按设置行和凭据行两级响应式换行
- 新增布局契约测试，禁止重新引入固定控制区最小宽度并约束 Save 始终处于凭据 Grid 内

**验证:**

- `bun run lint`、`bun run format`、Vitest 25 文件 / 122 测试、Vite 生产构建与 `git diff --check` 通过

### Session #043 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | 备份密码持久化与主机操作悬浮根因修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将备份密码控件收紧为 Password、Confirm password 与 Save 同行布局，确认标签保持单行并扩大控件侧可用空间
- 新增独立备份密码保存命令，前后端共同校验最少 8 字符与两次输入一致，成功后由设备主密钥加密保存
- 已保存密码再次变更时增加二次确认，明确已有便携备份仍需旧密码且 WebDAV 要在下一次同步后才切换新密码
- 既有 Vault 改密时重新包装本机 Vault Key；保存操作与同步锁串行化并取消待执行的自动同步，避免密钥信封竞态
- 定位主机悬浮按钮未隐藏的根因是 `:hover` / `:focus-within` CSS 优先级覆盖状态类；改为排除拖动和抑制态的显式显示条件，并仅保留键盘 `focus-visible`

**验证:**

- `bun run lint`、`bun run format`、Vitest 25 文件 / 122 测试与 Vite 生产构建通过
- Rust 99 项库测试、全特性 Clippy（`-D warnings`）、`cargo fmt --check`、隔离 target 类型导出与 `git diff --check` 通过

### Session #042 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Vault 设置语义、错误国际化与主机卡片交互修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将主机卡片点击后的操作按钮抑制改为按主机跟踪，鼠标离开卡片后才恢复，避免静止 `:hover` 立即重新显示按钮
- 将共用 Backup password 从便携备份卡中拆为独立设置项，明确其同时用于便携加密和 WebDAV 云端恢复
- 为 Vault 的 WebDAV URL、用户名、WebDAV 密码和备份密码增加当前语言的前端必填校验
- Vault 后端错误改为按 `ErrorCode` 映射中英文文案，避免英文界面直接展示后端中文 `message`
- 补充主机悬浮状态、密码设置位置和 Vault 国际化错误边界的回归测试

**验证:**

- `bun run lint`、`bun run format`、Vitest 25 文件 / 122 测试与 Vite 生产构建通过

### Session #041 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Vault 暂停语义、共用密码与全局状态收口 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将设备停用改为真正的暂停同步，完整保留本机 WebDAV 配置、加密密码、Vault Key、revision 和最近同步时间
- WebDAV “测试连接”改为“测试并保存”，允许在不启用同步时先保存本机加密配置
- 便携导出与 WebDAV 改为共用一份由设备主密钥保护的备份密码，空输入自动复用已保存值
- 新增恢复同步入口；恢复后立即同步当前配置
- 全局状态栏显示保险库启用/暂停状态与最近成功同步时间，并按后端策略周期刷新
- 主机排序结束后统一抑制所有卡片悬浮操作，直到下一次真实指针移动，避免实时换位遗留悬浮按钮

**验证:**

- `bun format`、`bun lint`、Vitest 25 文件 / 121 测试与 Vite 生产构建通过
- Rust 97 项库测试、类型导出、`cargo fmt --check` 与全特性 Clippy（`-D warnings`）通过
- `git diff --check` 通过；运行中的开发应用保持不被终止，Rust 使用隔离 target 完成验证

### Session #040 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | 跨设备加密保险库与 WebDAV 配置同步 |
| **参与者** | 用户 + AI |

**完成事项:**

- 保留 Windows Credential Manager + `enc.v1` 本地加密，新增 Argon2id + AES-256-GCM 的 `vault.v1` 跨设备保险库
- 支持备份密码保护的本地便携导入/导出；新设备恢复后使用自己的系统主密钥重新加密所有主机密码
- WebDAV 固定使用 `/SY-TFM/sy-tfm-vault.sytfm`，协议访问仍经 `FileTransport` Adapter 调度
- 支持首次启用、立即同步、云端恢复、当前设备停用和 1.5 秒配置变更防抖自动同步
- 使用 Vault ID + revision 检测云端较新版本，拒绝静默覆盖；云端已有 Vault 时首次启用要求先恢复
- 跨设备载荷改为备份全部配置、目录设置、主机信任记录及背景图片字节；恢复时背景图片写入当前设备应用数据目录
- WebDAV 设置新增只读连接测试；“启用并上传”和“从云端恢复”使用一致按钮尺寸
- 设置页新增 Glass Vault 状态卡，完成默认窗口和最小桌面窗口视觉检查

**验证:**

- `bun format`、`bun lint`、Vitest 25 文件 / 118 测试与 Vite 生产构建通过
- Rust 96 项库测试、`cargo fmt --check` 与全特性 Clippy（`-D warnings`）通过
- 当前开发进程锁定主二进制时，使用隔离 target 执行 `cargo test --test export_types` 通过并同步生成 TS 类型
- 设置存储页完成默认视口与 760×520 最小桌面窗口视觉检查

### Session #039 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | 桌面文件快捷键与主机排序交互收口 |
| **参与者** | 用户 + AI |

**完成事项:**

- 文件面板增加桌面原生快捷键：`Delete` 对当前选择执行已有二次确认删除，`F2` 在单选时打开重命名面板
- 快捷键仅作用于活动文件面板，并避开输入框、可编辑区域、弹窗、菜单与 CodeMirror，防止编辑过程误触文件操作
- 文件右键菜单为重命名与删除显示 `F2` / `Del` 快捷键提示
- 主机排序统一为 `dnd-kit Sortable` 垂直实时移位，移除重复的悬浮上移/下移按钮与右键菜单排序项

**验证:**

- `bun format`、`bun lint`、Vitest 24 文件 / 115 测试、Vite 生产构建通过
- Rust 85 项库测试、`cargo fmt --check` 与全特性 Clippy（`-D warnings`）通过
- Windows v1.0.0 NSIS release 安装包重新构建成功

### Session #038 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | Sortable 主机排序、编辑类型保护、时间与状态栏格式化 |
| **参与者** | 用户 + AI |

**完成事项:**

- 修复连接副标题最终被后置 `9px` 规则覆盖的问题，最终样式层绑定 `--type-caption-size`，可实时响应“提示与说明”设置
- 引入官方 `@dnd-kit/sortable`、`modifiers` 与 `utilities`：主机拖动时相邻卡片实时让位，并通过 `restrictToVerticalAxis` 禁止横向偏移
- 拖动中及落下后暂时抑制主机悬浮操作按钮，直到指针离开卡片，避免操作区残留
- Online Edit / Remote Edit 在发起远程读取前识别常见文本类型；视频等二进制文件改为主题化提示弹窗，不再向状态栏写入 HTTP 错误
- WebDAV HTTP-date 与 SFTP 时间统一显示为 `YYYY-MM-DD HH:mm` 本地时间
- 单个传输任务在底部状态栏中使用自动边距居中，修复最大化双面板下的视觉偏移

**验证:**

- `bun format`、`bun lint`、Vitest 24 文件 / 113 测试、Vite 生产构建通过

### Session #037 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | 主机拖排插入指示、浮层定位与字号层级修正 |
| **参与者** | 用户 + AI |

**完成事项:**

- 主机拖排由整卡高亮改为插入位置的强调色边界线，向上/向下移动分别准确标识落点前后槽位
- DragOverlay 使用鼠标中心修正 modifier，并与源卡片保持一致尺寸，消除浮层固定偏在指针下方的割裂感
- 主机悬浮操作区以双箭头组合的总高度垂直居中，编辑、连接和删除按钮恢复同一水平中线
- 修复连接面板副标题被高优先级固定 `11px` 覆盖的问题，明确绑定 `Hints & captions` 的 `--type-caption-size`

**验证:**

- `bun format`、`bun lint`、Vitest 24 文件 / 110 测试、Vite 生产构建通过

### Session #036 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | 主机拖排边界、右键排序与桌面文本选择修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 主机拖排改为固定原卡片、独立 Glass 浮动预览与指针落点高亮，关闭自动滚动并限制横向溢出，避免边缘拖动扩张滚动空间
- 上移/下移按钮扩大至 28×20px 命中区，图标同步增大；主机右键菜单补齐带边界禁用的上移/下移操作
- 将 `Ctrl+A` 从已连接的 BrowserPage 提升到全局应用层，空白面板也会阻止 WebView 页面全选并主动清除残留 DOM Selection
- body 与 Portal 默认采用文件管理器不可选语义，输入/编辑控件继续可选；状态栏单独恢复可选、可复制文本

**验证:**

- `bun format`、`bun lint`、Vitest 24 文件 / 109 测试、Vite 生产构建通过

### Session #035 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | 状态栏生命周期、主机排序与桌面选择语义 |
| **参与者** | 用户 + AI |

**完成事项:**

- 修复连接中提示结束后旧 Remote Edit 失效消息重新出现：任何更新的连接生命周期会清除旧 operation notice，重连中的失效事件不再覆盖当前状态
- 复用 `@dnd-kit/core` 实现主机卡片拖放排序，悬浮操作区增加紧凑纵向上移/下移按钮与落点动画
- 新增 `reorder_hosts` 原子命令，仅按 ID 从已有完整配置重排并持久化；顺序不完整、重复或含未知主机时拒绝保存
- 应用壳层禁用浏览器式文本选择；`Ctrl+A` 在非输入/编辑器/弹窗焦点下改为选择活动文件面板全部项目（排除 `..`）
- 补齐中英文提示、排序持久化、密码字段保持、状态清理和交互接线回归测试

**验证:**

- `bun format`、`bun lint`、Vitest 24 文件 / 108 测试、Vite 生产构建通过
- Rust 85 项库测试、`cargo fmt --check` 与全特性 Clippy（`-D warnings`）通过

### Session #034 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | AList WebDAV 目录语义修复与高清图标刷新 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位 2789 项的根因：`PROPFIND` 未发送 `Depth`，按 RFC 4918 缺省为 `infinity`，AList 返回整棵目录树
- 目录列表固定使用 `Depth: 1`，连接验证、目录验证与健康探测使用 `Depth: 0`
- 将服务端 `/dav/...` 或绝对 URL href 映射为 adapter 内部 `/...` 逻辑路径，避免进入目录时形成 `/dav/dav/...` 404
- 即使服务端忽略有限 Depth，解析层仍只接受当前目录直属子项；补齐根目录、嵌套目录、绝对 href 和请求头回归测试
- 验证用户替换的 1024×1024 ARGB 透明源图，并重新生成 Windows、macOS、iOS、Android 全套 Tauri 图标

**验证:**

- WebDAV Rust 聚焦测试、完整 Rust/前端质量门禁与图标资源生成

### Session #033 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | Remote Edit 同名临时文件可见隔离 |
| **参与者** | 用户 + AI |

**完成事项:**

- 确认旧实现通过完整 UUID 父目录隔离会话，虽然不会覆盖，但系统编辑器中只显示源文件名，不符合原定可见命名
- 临时文件改为 `<源文件名>_<UUID 后 8 位>.<扩展名>`，同时保留完整 UUID 会话目录与 `(hostId, remotePath)` 复用键
- 对超长 Unicode 文件名按 UTF-16 单元安全截断，保留常规扩展名且不超过 Windows 255 单元限制
- 新增不同远程目录下同名文件生成不同可见临时文件名的回归测试

**验证:**

- Remote Edit Rust 聚焦测试、完整 Rust/前端质量门禁

### Session #032 — 2026-07-18

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **类型** | Windows 桌面 v1.0.0 基线收口 |
| **参与者** | 用户 + AI |

**完成事项:**

- 消除生产下载链路中的 3 个 `expect()`，将已关闭临时文件和缺失长度转换为可恢复错误，并新增源码级回归守卫
- 使用用户提供的透明 1024×1024 源图生成 Windows、macOS、iOS、Android 全套 Tauri 图标，并纳入 bundle 配置
- Remote Edit 启动时清理崩溃遗留的 UUID 会话目录；通过 `fs2` 独占租约保护其他正在运行的 SY-TFM 实例
- 完成 Windows release/NSIS 构建与启动冒烟：主窗口成功创建、响应正常并可正常关闭
- 将 Windows 桌面端标记为 v1.0.0 自动化基线，真实 SFTP/WebDAV、DPI 与外部编辑器组合保留为人工兼容性矩阵

**验证:**

- `bun lint`、`bun format`、`bun run test`（22 文件 / 102 测试）、`bun run build`
- `cargo fmt --all -- --check`、`cargo test --lib --features protocol-adapters`（81 测试）、`cargo clippy --lib --all-features -- -D warnings`
- `bun run types:export`、`bun run tauri build -- --bundles nsis`、release 主窗口启动/响应/关闭冒烟

### Session #031 — 2026-07-17

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-17 |
| **类型** | Remote Edit 活动监听复用与入口补全 |
| **参与者** | 用户 + AI |

**完成事项:**

- Remote Edit 启动前按 `hostId + remotePath` 查找有效会话，命中时直接复用原临时文件与 watcher，不再重新下载或覆盖本地内容
- 使用异步创建锁串行化查重与建会话流程，避免连续触发同一文件时竞态创建重复 watcher
- 新增当前主机有效编辑会话查询命令；自动过滤主机已失效或本地临时文件已不存在的条目
- 路径栏下载按钮后新增紧凑监听入口，以计数点和 Glass 浮层展示文件名与远程路径，点击可重新交给系统编辑器打开
- 补齐中英文状态、API/数据模型文档、Rust 复用测试、前端集成测试与自动生成 TypeScript 类型

**验证:**

- 隔离 target `cargo test --test export_types`、Remote Edit Rust 聚焦测试
- `bun lint`、`bun format`、`bun run test`、`bun run build`、`cargo fmt`、`cargo clippy`

### Session #030 — 2026-07-17

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-17 |
| **类型** | 传输取消状态语义修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位取消传输后连接数量变红的根因：状态栏把“未成功、已结束且有提示”的取消结果误判为传输失败
- 为传输状态增加独立 `isCancelled` 语义，并在上传、下载和跨面板传输的所有完成分支中准确记录
- 全局错误色判断排除已取消任务，取消保持中性提示，真实上传、下载或跨面板失败仍正常标红
- 新增取消结果不污染全局连接状态颜色的交互回归测试

**验证:**

- `bun lint`、`bun format`、`bun test`、`bun run build`

### Session #029 — 2026-07-17

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-17 |
| **类型** | 桌面交互过渡与批量取消响应收尾 |
| **参与者** | 用户 + AI |

**完成事项:**

- 主机连接请求在前端发起时立即进入 `connecting`，状态栏显示目标主机名称与独立 loading 动画；连接成功或失败后状态同步收敛
- 修复面板主机下拉引用不存在动画关键帧的问题，统一使用 Glass rise 动画，并为下拉箭头增加展开旋转过渡
- 主机侧栏由 `display: none` 瞬时移除改为网格宽度、间距、透明度和位移联合过渡，显示与隐藏均有完整动画
- 传输取消点击后立即进入 cancelling 状态，冻结可见进度并在取消按钮内显示 spinner；移除禁用按钮的系统 wait 鼠标指针
- 文件夹下载、上传和跨面板传输的远程目录枚举与建目录操作纳入取消竞争，不再必须等待当前远程操作自然返回
- 新增 Store 即时取消反馈、CSS 交互契约和 Rust pending operation 取消回归测试

**验证:**

- `cargo fmt --all -- --check`、`cargo test --lib --features protocol-adapters`（45 tests）、`cargo clippy --lib --all-features -- -D warnings`
- `bun lint`、`bun format`、`bun test`（22 files / 92 tests）、`bun run build`

### Session #028 — 2026-07-17

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-17 |
| **类型** | 真实连接健康检查与前后端状态同步 |
| **参与者** | 用户 + AI |

**完成事项:**

- 修复 SessionManager 仅以会话表存在性判断在线的根因：每次状态查询均调用 `FileTransport::is_connected()`，失效后清除会话
- SFTP 改为读取 russh Handle 的真实关闭状态；WebDAV 改为对当前目录执行 10 秒超时的 PROPFIND 健康探测
- 新增 5 秒后端会话监控，真实断线后主动发送 `reconnecting` 状态；前端消费事件立即尝试恢复，失败则从连接集合和面板分配中收敛
- 会话清理使用 `Arc::ptr_eq` 验证连接代次，避免迟到的旧健康检查误删同一主机刚建立的新会话
- 主机在线指示灯严格根据 `connected` 状态显示；连接中与重连中使用 busy 状态，不再把待恢复会话显示成在线
- 将 keepalive、健康检查和探测超时集中到连接策略枚举，并同步架构文档与实现计划

**验证:**

- `cargo fmt --all -- --check`、`cargo test --lib --features protocol-adapters`（44 tests）、`cargo clippy --lib --all-features -- -D warnings`
- `bun lint`、`bun format`、`bun test`（22 files / 88 tests）、`bun run build`

### Session #027 — 2026-07-17

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-17 |
| **类型** | 状态栏自适应与在线编辑同步提示收敛 |
| **参与者** | 用户 + AI |

**完成事项:**

- 确认 SFTP 使用 russh 15 秒 keepalive、最多 3 次未响应配置；正常服务端持续响应时连接不因空闲自动断开
- 定位状态栏溢出来自固定 26px 高度、可调数据字号与未约束的完成 SVG 图标共同作用
- 状态栏高度改为根据数据字号在 26–38px 范围自动计算，容器、任务条、图标和单行文本均受同一高度边界约束
- Online Edit 保存不再创建可见上传任务卡，只在左侧状态区域显示打开、同步中、同步完成或失败；后端传输注册与清理仍保留

**验证:**

- `bun lint`、`bun format`、`bun run test`（22 files / 87 tests）、`bun run build`

### Session #026 — 2026-07-17

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-17 |
| **类型** | Online Edit 与 Remote Edit 完整链路 |
| **参与者** | 用户 + AI |

**完成事项:**

- 新增协议无关的 `EditSessionManager`：远程文件下载到 `%TEMP%/SY-TFM/源文件名_UUID.扩展名`，监听目录内 Create/Modify 事件并以 500ms 防抖自动上传
- 外部编辑调用系统默认应用；同一主机同一路径的新会话替换旧监听，主机断开时统一失效、发出事件并清理临时文件
- 新增 `read_remote_text`，仅接受 UTF-8 且限制 5 MiB；在线编辑器使用 CodeMirror 6 按文件名懒加载常见语言高亮，支持换行、Ctrl+S 和不关闭窗口的保存同步
- Online Editor 延续全局 Glass 主题、强调色、字体令牌、模糊度与透明度设置；编辑器代码与语言包独立懒加载，避免增加首屏入口负担
- 右键菜单的 Online Edit / Remote Edit 从占位提示切换到真实操作；在线与外部同步结果统一写入底部状态栏，外部保存后刷新对应主机面板
- 补齐 `editor:synced`、`editor:error`、`editor:session-invalid` 类型、Tauri 能力白名单、中英文文案、接口文档和自动生成 TypeScript 类型

**验证:**

- `bun lint`、`bun format`、`bun run test`（22 files / 85 tests）、`bun run build`
- `cargo fmt --all -- --check`、`cargo test --lib`（42 tests）、`cargo clippy --lib -- -D warnings`、`cargo check`
- 独立 target 运行 `cargo test --no-default-features --test export_types`，类型导出通过

### Session #025 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 原生外链、窗口状态、连接表单与启动警告清理 |
| **参与者** | 用户 + AI |

**完成事项:**

- About GitHub 地址统一为 `https://github.com/ygq-future/SY-TFM`，接入官方 `tauri-plugin-opener`，点击后由系统默认浏览器打开
- 标题栏订阅原生窗口 resize/maximized 状态：正常窗口显示向外最大化图标，最大化后切换为向内还原图标，双击标题栏与按钮共用同一状态同步逻辑
- Protocol 文案改为独立的表单标签，不再通过原生 `label for` 误触 Select；字号统一消费全局 Label 令牌
- 已保存密码提示与清除操作压缩为单行，状态文本支持省略，操作按钮固定不换行；同步精简中英文文案
- 原生主窗口启动时先隐藏，React 与首屏样式完成两帧布局后调用 `show()`，消除 WebView 初始化阶段的白屏闪烁；补齐非浏览器环境的语言检测判空
- 设置中心改为按需懒加载，并将 React、桌面 UI 与状态库拆为可缓存独立 chunk，降低主入口解析成本
- Rust lib target 改为 `sy_tfm_lib`，消除 bin/lib 的 PDB 同名冲突；对 MSVC 成功链接信息使用 `linker_messages` 定向降噪
- 将 russh 从 0.54.5 升级到 0.62.2、russh-sftp 更新到 2.3.0，并将 Rust MSRV 同步到 1.85；旧版 future-incompatibility 警告已消失

**验证:**

- `bun lint`、`bun format`、`bun test`（80 tests）、`bun run test`（20 files / 80 tests）、`bun run build`；主入口降至 349.22 KiB 且无 chunk size warning
- `cargo fmt --all -- --check`、`cargo clippy --all-targets --no-default-features --features protocol-adapters -- -D warnings`
- `cargo build --no-default-features --features protocol-adapters` 零 warning；Rust lib 36 tests 与独立 `export_types` 测试通过

### Session #024 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 双面板列宽与传输进度语义修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将双面板 Size、Owner、Permissions、Modified 的最终覆盖宽度从 `48/58/72/92px` 调整为 `60/70/96/118px`，同时允许名称列在极窄面板下进一步收缩，优先保证固定格式元数据完整可读
- 新增任务级进度映射：多文件上传按文件序号累计，跨主机中转将下载和上传分别映射到当前文件的前后半段
- 子文件或中间阶段最高只显示 99.5%，仅在整个任务调用链成功后显示 100%；所有进度更新保持单调递增，不再出现 `100% → 0%`

**验证:**

- `bun run format`、`bun run lint`、`bun run test`（19 files / 74 tests）、`bun run build`

### Session #023 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 并发传输、取消/超时与桌面拖入闭环 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将 `SessionManager` 的会话表改为短时持锁的 `Arc<Session>` 快照，网络 await 前释放全局锁；断开连接先移除会话再关闭 adapter，消除传输卡住后所有操作 loading 且无法断开的锁等待
- 新增 `TransferManager`，每个上传、下载、跨主机任务使用独立 `operationId` 与取消信号；同一会话支持并发传输，断开主机前会先取消关联任务
- 为流式传输增加 45 秒无进度超时，为连接和普通远程操作增加统一超时；上传/下载缓冲提升到 256 KiB，WebDAV 上传改为流式 body，进度事件改为非阻塞并以 100ms 节流推送 WebView
- 状态栏改为可同时展示多个 Glass 任务条，分别显示进度、数量、速度、完成状态和取消按钮；旋转指示器使用独立合成层，避免高频 React 更新造成卡顿
- 跨主机拖动落到目标面板普通文件或空白区域时统一传输到该面板当前目录，落到目录时进入该目录；保留移动/传输二次确认
- 监听 Tauri 原生窗口拖放事件，支持从 Windows 资源管理器将文件或目录路径直接拖入指定面板并流式上传
- 双面板紧凑模式保留 Name、Size、Owner、Permissions、Modified 全部元数据列

**验证:**

- `bun run lint`、`bun run format`、`bun run test`（19 files / 73 tests）、`bun run build`
- `cargo fmt --check`、`cargo test --lib`（36 tests）、`cargo clippy --lib -- -D warnings`

**说明:**

- SFTP 普通上传/下载通过 SSH 加密通道；跨主机仍是“源主机 → 本地临时文件 → 目标主机”的顺序中转，不是两台服务器直连，整体耗时约为两个阶段之和
- Rust 后端新增命令和状态管理后需重启当前 Tauri 开发进程才能生效

### Session #022 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 文件列表密度、拖拽坐标与批量下载状态修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将主机标签从表单 Label 层级降为 Caption 层级并加入宽度截断，避免标签挤出卡片；文件列表移除重复的 `FOLDER` 文字标记
- 在共享 grid 中缩短 Permissions/Modified 固定列宽，使 Size、Owner、Permissions 整组向右收紧、Modified 单独向右，并微调 Name 与图标起点
- 默认下载目录解析为操作系统 Downloads 下的 `SY-TFM` 子目录，设置中心仍显示实际解析路径
- 目录递归下载新增文件级批次事件；单选、多选、目录及上传状态统一显示当前/总数、百分比和实时速度，修复子文件完成事件反复结束批次导致的转圈卡顿
- 扩展 Python、Rust、TypeScript/JSX、Go/C/C++、Ruby、PHP、Swift、前端样式、Docker Compose、Dockerfile 与常用脚本图标，并增强小图标的轮廓和色彩辨识度
- 点击面板非交互空白区域会清空当前选择；拖拽预览改为窗口级原始指针坐标，普通文件行作为阻断落区、目录作为有效落区，单/双面板保持相同语义与二次确认

**验证:**

- `bun run format`、`bun run lint`、`bun run test`（19 files / 70 tests）、`bun run build`
- `cargo fmt`、`cargo check`、`cargo test --lib`（34 tests）、`cargo clippy --lib -- -D warnings`

**说明:**

- 标准 Rust 全量测试因用户当前运行的 `sy-tfm.exe` 被 Windows 锁定而无法替换主程序；不依赖该二进制的 34 个库测试与 Clippy 全部通过

### Session #021 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 文件表格坐标修复、字体体系与 Glass 视觉回归 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将文件表头移入虚拟列表的垂直滚动容器并设为 sticky，表头和数据行共享同一 grid 与滚动条 client width；Size、Owner、Permissions、Modified 使用紧凑固定列宽
- 修复 Name、Size、Modified 表头点击事件，增加排序状态可访问属性；真实 FileList 浏览器验证三列排序结果与四个数据列对齐误差 `0px`
- 建立正文/控件、标题、标签/表头、提示/说明、数据/路径五级字体令牌，全部接入通用设置并持久化；Windows 字体栈优先使用 Microsoft YaHei，关键中文文本使用标准字重
- 提高主机卡片常态表面可见度，悬浮操作改为三个独立 glass 按钮；Glass opacity 调整为完整 `0-100%` 范围
- 强化浅色设置面板与遮罩的明度、边框和阴影对比，移除左侧选中勾选；禁用 WebView 原生右键菜单
- About 元数据统一为 SY-TFM 1.0.0 / Sheepyu / `ygq-future/SY-TFM.git`，WebDAV 示例改为通用测试域名

**验证:**

- `bun run format`、`bun run lint`、`bun run test`（19 files / 66 tests）、`bun run build`
- `cargo fmt --check`、`cargo clippy --lib --tests -- -D warnings`、`cargo test --lib`（33 tests）、独立 `export_types`（1 test）
- 实际浏览器验证五级字号控件、浅色设置对比、About 元数据、文件列对齐误差 `0px` 和 Name/Size/Modified 三种排序交互

**说明:**

- 标准 `bun run types:export` 仍因用户正在运行的 `sy-tfm.exe` 被 Windows 锁定而无法覆盖主程序；最新编译出的同一 `export_types` 测试程序已在 `src-tauri` 工作目录直接执行通过并同步生成类型

### Session #020 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | WebDAV 连接建模、面板同步与文件表格精修 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将 WebDAV 编辑表单改为认证 URL、HTTP/HTTPS、用户名、密码与可选基础路径；URL 可直接输入 `https://dav.example.com/remote.php/dav`，保存时规范化 scheme，adapter 正确合并 URL 自带路径、兼容旧端口与可选 base path
- 新建/编辑连接统一增加“测试连接”，后端使用隔离 `SessionManager` 验证表单配置，不保存、不占用正式会话，并支持复用已有主机的加密密码
- 修复主机侧栏隐藏 class 拼接；单面板双击已连接主机可直接切换，未连接主机会连接后切换；双面板连接第二主机不再因 capability 对象变化重载第一面板
- 文件列表名称、大小、修改时间恢复整格可点击排序；表头与数据行复用同一 grid，缩小图标/名称间距并统一 size、owner、permissions、modified 左对齐
- 设置中心玻璃表面直接消费全局 blur/opacity 根变量；背景图片增加独立启用开关，关闭后保留图片路径和显示参数
- Windows OpenSSH 路径复制前统一规范化，移除盘符前多余的 `/`；SFTP Port 与 Tags 使用相同四列宽度

**验证:**

- `bun run format`、`bun lint`、`bun run test`（19 files / 61 tests）、`bun run build`
- `cargo fmt --check`、`cargo clippy --lib --tests -- -D warnings`、`cargo test --lib`（33 tests）、独立 `export_types`（1 test）、`cargo check --bin sy-tfm`
- 实际浏览器交互验证：主机栏隐藏为 `display: none`；SFTP Port/Tags 均为 162.8px；WebDAV 无 Port/重复 HTTPS 开关；设置面板计算样式为 22px blur 并继承 0.72 opacity

**说明:**

- 标准 `bun run types:export` 因用户正在运行的 `sy-tfm.exe` 被 Windows 锁定而无法覆盖主程序；本轮已编译的同一 `export_types` 测试程序在 `src-tauri` 工作目录直接执行通过
- 新增 Tauri `test_host_connection` 命令后，需要重启正在运行的开发应用才能加载新后端命令

### Session #019 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 全局双语、主题对比度与配置导入闭环 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将标题栏、主机、文件浏览、右键菜单、连接表单、密码解锁、设置中心、状态栏及错误提示的可见文案统一迁移到 i18next；语言切换即时影响整个应用，并增加中英文键结构一致与源码中文硬编码扫描测试
- 通知系统改为消费当前明暗主题和全局玻璃 token，修复暗黑模式白底浅字；通知区域与关闭按钮的无障碍文本也随语言切换
- 明亮主题提高正文、次要文字、图标与玻璃底板对比度，在启用全局背景图片时使用独立 underlay，避免内容被背景稀释
- 确认加密配置导出原本已包含主机信息；修复导入后仅刷新设置、不刷新 connection store 导致主机列表看似未恢复的问题
- 背景图片设置改为显示并可编辑本地路径，新增受扩展名与 20 MiB 上限约束的后端图片读取命令；默认下载路径和应用数据路径显示操作系统解析后的实际目录
- 新增 `StoragePaths` 后端模型与自动生成 TypeScript 绑定，原生保存/选择对话框标题与文件类型名称全部接入当前语言

**验证:**

- `bun run format`、`bun lint`、`bun run test`（18 files / 52 tests）、`bun run build`
- `cargo fmt`、`cargo clippy --lib --tests -- -D warnings`、`cargo test --lib`（31 tests）、独立 `export_types`（1 test）、`cargo check --bin sy-tfm`
- 实际浏览器交互验证中英文全局即时切换；暗黑导出错误通知计算样式为深色背景与浅色正文；明亮背景图场景的标题、主机与次要文字保持清晰

**说明:**

- 新增 Rust 命令后需重启正在运行的 Tauri 开发进程，前端才可调用平台实际路径与本地背景图片读取接口

### Session #018 — 2026-07-16

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-16 |
| **类型** | 拖拽命中重构、双面板分配规则与完整设置中心 |
| **参与者** | 用户 + AI |

**完成事项:**

- 移除虚拟文件行的 CSS transform 定位，改用真实 top 坐标，使 dnd-kit 测量到的目录落区与屏幕位置一致；目录落区优先于面板背景，并用固定视口坐标的轻量拖拽预览消除鼠标偏移
- 新增纯函数化面板分配规则：无连接时新主机固定进入面板一，后续连接进入面板二；断开面板一时自动提升面板二，全部断开时双面板同时清空，折叠为单面板时保留有效连接
- 路径编辑改为将光标移到末尾；省略路径菜单只居中显示当前层级名称，不泄露整段路径；移除目录内容/选择统计行及状态栏单/双面板提示
- 标题栏新增主机侧栏开关与窗口置顶，操作顺序收敛为主题、置顶、设置；修复侧栏隐藏状态 class 拼接导致样式未生效的问题
- 完成四分区设置中心：中英语言与字号；明暗主题、10 套强调色、背景图片/不透明度、毛玻璃模糊与透明度；下载/数据路径、系统选择器、加密导入导出；应用版本、开发者、许可证与 GitHub 信息
- 设置持久化扩展到 `settings.json`，自定义数据路径通过默认位置 locator 引导；配置导出使用现有 AES-256-GCM 系统密钥加密，导入时解密校验后写回
- Windows 中文字体栈改为 Microsoft YaHei UI / Microsoft YaHei 优先，保留跨平台中文字体回退

**验证:**

- `bun run format`、`bun lint`、`bun run test`（15 files / 46 tests）、`bun run build`
- `cargo fmt`、`cargo clippy --lib --tests -- -D warnings`
- `cargo test --lib`（30 tests）与独立 `export_types` 测试（1 test）
- 1280×720 与 900×600 实际渲染检查；设置面板在紧凑视口保持边界内滚动，10 种强调色与三项外观滑块完整显示

**说明:**

- 完整 `cargo test --lib --tests` 因当前正在运行的 `sy-tfm.exe` 被 Windows 锁定而无法覆盖二进制；库单测、类型导出测试及 Clippy 已分别通过
- russh 0.54.5 仍有上游 future-incompatibility 提示，继续列入依赖维护跟踪

### Session #017 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 双面板拖拽传输、递归目录下载与桌面交互修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将两个文件面板提升到同一个 dnd-kit 上下文，拖拽预览 Portal 到应用顶层以消除坐标偏移；文件夹命中时显示明确“放入”提示
- 同一主机拖拽执行带二次确认的移动，不同主机拖拽调用协议无关的 `transfer_entry` 命令，经临时文件递归中转文件与目录；移除右键“传输到…”入口
- 后端下载命令支持递归目录遍历与本地目录创建，修复把文件夹直接交给 adapter 文件下载而返回 `Failure: Failure` 的问题
- 每级目录固定在首行加入 `..`；文件行高收紧到 27px，表头恢复可点击排序，权限失败等全局操作错误使用红色状态栏反馈
- 面板状态绑定 `hostId` 并丢弃迟到的旧主机目录响应，解决连接/切换主机后路径和 home 仍属于上一主机的竞态
- 路径模型同时支持 POSIX 与 Windows OpenSSH 反斜杠路径；面包屑使用 `ResizeObserver` 按真实可用宽度折叠，编辑时自动全选完整路径
- “下载到…”和主机下载路径均接入 Tauri 原生目录选择器；主机下载路径保持整行可输入，并在右侧提供资源管理器按钮
- 主机卡片支持未连接时双击连接、已连接时双击仅打开而不切断；修正悬浮按钮虚影/黏连、文字选中和主机字号
- 标题栏中间移除主机名；中文字体栈改为 Segoe UI Variable Text + Microsoft YaHei UI/PingFang SC，并恢复系统字体栅格化

**验证:**

- `bun run lint && bun run format && bun run test`（41 tests）
- `bun run build`
- `cargo fmt --all`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --all-features`（30 unit tests + 1 export test）
- 1280×720 与 900×650 实际渲染检查；连接表单在紧凑视口完整可见，下载路径输入和选择按钮未裁切

**说明:**

- 原生目录选择使用官方 `tauri-plugin-dialog`；已加入前端依赖、Rust 插件初始化和 `dialog:default` capability
- 跨主机/跨协议传输当前使用本地临时文件中转，Phase 4 再评估流式管道、并发和断点续传

### Session #016 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 桌面双面板、路径栏、传输状态与拖拽安全重构 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将单例浏览状态改为双面板索引状态；每侧独立维护主机、路径、家目录、文件、选择、排序、能力与加载错误，第二面板不再是静态占位
- 路径栏首项改为仅列出已连接主机的微型 Glassmorphism 选择器；长路径保留根、首段和末段，中间节点收入可导航的省略菜单
- 路径操作按 home、编辑、复制、分隔、刷新、上传、下载排列，并强化路径分隔符；移除“面板 1/2”字样
- 新增标题栏设置入口和紧凑设置面板，全局字号 10–18px 实时调整并通过 `settings.json` 持久化；默认字号提升至 12px
- SFTP 元数据优先显示 `user:group`，服务端不返回名称时回退 `uid:gid`；权限由八进制改为 `rwxr-xr-x` 字符串
- 多选右键菜单移除重命名；名称标题与文件图标左对齐，其他列统一左对齐并重新分配修改时间列宽
- 删除上传/下载悬浮进度卡和成功 toast，上传、下载、错误与完成百分比统一显示在全宽状态栏，状态栏不再显示当前路径
- 拖拽关闭自动滚动并改用 pointer-within 命中；原行不再跟随指针扩张滚动区，移动操作新增包含目标目录的二次确认
- 公共下拉选项悬浮态提高强调色混合比例，解决亮色模式下反馈过淡

**验证:**

- `bun lint`
- `bun format`
- `bun test`（37 tests）
- `bun run build`
- `cargo fmt --check`
- `cargo clippy --lib -- -D warnings`
- `cargo test --lib transport::sftp_adapter::impl_::tests`（2 tests）
- `export_types` 生成的测试程序直接执行通过；常规 Cargo 命令因正在运行的 `sy-tfm.exe` 文件锁未能完成最终清理
- 1280×720 实际渲染与设置面板交互检查；字号 12px → 13px 后根变量和预览同步，无浏览器控制台错误

### Session #015 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 文件浏览密度与右键菜单定位修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位文件右键菜单偏移根因：菜单位于带 transform 动画的文件面板内，`position: fixed` 使用局部定位上下文，却接收视口 `clientX/clientY`
- 文件菜单改为通过全局 Portal 挂载至 `body`，与主机菜单使用一致的坐标系，彻底消除面板起点造成的横向偏移
- 使用菜单真实渲染宽高计算位置；默认紧贴鼠标右下，靠近右/下边缘时自动翻转到左/上，极小视口下保留 8px 安全边距
- 文件虚拟列表行高由 34px 收紧至 30px，图标底板和文字同步缩小，虚拟定位与视觉高度继续共用单一常量
- 压缩路径段按钮内边距、图标间距、分隔箭头尺寸和外边距，形成更连续的路径阅读节奏
- 扩充文件语义图标：JSON、配置、终端脚本、数据库、证书密钥、字体、演示文稿、安装包、磁盘镜像及常见项目特殊文件

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（35 tests）
- `bun run build`
- 新增右键菜单 Portal、真实尺寸和四向边缘翻转回归测试

### Session #014 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 密码持久化修复 + 连接表单公共组件收敛 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位 Windows 密码无法稳定解密的根因：`keyring 3` 未启用原生 feature，运行时落入不持久化的 mock credential backend
- 启用 Windows/macOS/Linux 原生凭据后端，并将主密钥生成改为系统安全随机源；首次写入后立即回读校验，阻止静默生成不稳定密钥
- 实测 Windows 主密钥连续读取稳定；确认旧 mock 密钥生成的密文不可恢复，旧主机连接时自动转入解锁面板，引导重新输入
- 主机编辑时空密码改为保留已有密文，新增显式“清除已保存密码”；解锁面板的“记住密码”现在会真正回写并重新加载加密配置
- 临时密码 override 增加 Rust 回归测试，保证原样传给 adapter、不尝试解密旧密文；认证错误保留 `AuthFailed` 错误码并显示具体用户名与服务器拒绝原因
- 新增共享 Glassmorphism `Select` 组件，统一协议和主机标签筛选下拉，选中、焦点、悬浮与浮层颜色均跟随全局强调色
- 连接表单将标签移至空间名称右侧并压缩为约 1/3 宽，下载路径调整为整行；800×600 下无滚动、无横向溢出、下拉浮层不裁切

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（31 tests）
- `bun run build`
- `cargo fmt`
- `cargo clippy --lib --tests -- -D warnings`
- `cargo test --lib --tests`
- Windows 原生 keyring 诊断：`master_key_stable=true`
- 800×600 真实渲染与下拉交互检查

**迁移说明:**

- 旧 mock 后端从未把主密钥持久化到系统，因此此前保存的密文无法数学恢复；用户只需为受影响主机重新输入并保存一次，之后由 Windows Credential Manager 稳定保护

### Session #013 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 文件浏览交互修复 + 连接表单密度调整 |
| **参与者** | 用户 + AI |

**完成事项:**

- 明确 Secure connection 提示布局语义：提示条整体左对齐，锁图标与说明文字保持同一横向行并在交叉轴居中
- 完整复核 PRD，连接编辑表单补回每主机下载路径；协议切换改为可扩展的紧凑下拉选择器
- 主机编辑面板改为内容驱动高度和 12 列非等宽网格，重新分配名称、地址、端口、账号、密码、标签与下载路径宽度
- 文件虚拟列表统一 34px 行高，补齐绝对定位边界，并为拖拽增加 6px 激活阈值，消除点击命中与视觉行错位
- 表头和数据行统一列顺序与宽度：名称、大小、所有者、权限、修改时间；文件图标和目录标签同步收紧
- 进入文件浏览时读取后端会话工作目录，不再硬编码根目录；路径栏根节点显示 `/`，支持双击编辑完整路径
- 右键目标由文件行截获并同步选择；按普通文件、文件夹和空白区域生成三套菜单结构
- AES-GCM 认证失败不再透传 `aead::Error`，改为提示系统密钥变化/跨设备配置并引导重新输入密码

**验证:**

- `bun run build`
- `bun run lint`
- `bun run test`（26 tests）
- `cargo test --lib crypto::secret_protector::tests::decrypt_with_changed_key_returns_actionable_message`

**说明:**

- 远程编辑、在线编辑与跨主机传输属于 Phase 2，右键菜单入口已按产品结构预留，当前会明确提示尚未接入后端命令
- 本地浏览器预览受预览地址策略限制未能完成截图；TypeScript 构建、DOM 结构测试和 Rust 定向回归测试均通过

### Session #012 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 弹窗退出策略 + 主机操作入口调整 |
| **参与者** | 用户 + AI |

**完成事项:**

- Secure connection 安全提示恢复左对齐并移除额外垂直居中，压缩提示、表单、输入框和操作区间距
- 所有 modal backdrop 移除关闭事件，弹窗只能通过关闭、取消或明确操作退出
- 主机栏头部移除删除按钮，主机卡片悬浮操作新增删除入口
- 新增主机专用右键菜单，提供编辑、连接/断开与删除；菜单通过 Portal 避免被侧栏裁切
- 两个删除入口统一进入危险操作二次确认；已连接主机删除前先断开会话
- 复核 SFTP 实现状态：adapter 已默认启用并支持密码认证，但尚无真实服务器集成测试，且不支持密钥/Agent/keyboard-interactive

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（21 tests）
- `bun run build`

---

### Session #011 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 弹窗主题与强调色状态统一 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位 Portal 弹窗强调色失效根因：accent 与 surface 别名仅存在于 app-shell，挂载至 body 的弹窗无法继承
- 将明暗主题、四套强调色和组件表面 token 提升至 document root，确保全局浮层与应用工作区使用同一真理源
- 弹窗表面重做为雾白/深海军蓝玻璃，并加入随强调色变化的轻微折射顶边
- 统一 input focus、主按钮、协议选择、编辑图标、WebDAV switch 和记住密码 checkbox 的强调色、glow 与高对比度文字
- Secure connection 安全提示改为水平居中的图标文字组，并使用当前强调色而非固定绿色
- 暗色冰川青和亮色冰川青均完成真实截图与 computed style 验证

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（19 tests）
- `bun run build`

---

### Session #010 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 全局弹窗定位修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位新建主机等弹窗被限制在侧栏内的根因：弹窗作为 host sidebar 后代渲染，而侧栏同时具有持久 transform 动画和 overflow 裁切
- 新增统一 `ModalPortal`，将主机编辑、密码、确认和输入弹窗挂载到 `document.body`
- 增加全局弹窗挂载回归测试，并保留无 DOM 服务端渲染环境的 children 回退
- 实际验证新建主机遮罩覆盖完整 1280×720 视口，面板水平居中，父节点为 BODY

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（17 tests）
- `bun run build`

---

### Session #009 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | Glassmorphism 视觉系统 + 双面板框架 |
| **参与者** | 用户 + AI |

**完成事项:**

- 将紧凑实用布局升级为统一 Glassmorphism 视觉系统：半透明表面、背景模糊、细描边、克制阴影与短促过渡动画
- 标题栏进一步压缩到 38px，并合并刷新、单/双面板切换、明暗主题、背景图片、强调色和原生窗口控制
- 新增默认单面板、可切换双面板的工作区骨架；两个文件面板均具有独立路径栏，为后续跨面板传输和独立导航预留状态边界
- 新增 26px 全宽全局状态栏，统一承载错误、加载、传输、连接数、当前路径、文件数和面板模式
- 建立持久化外观状态：light/dark 两种主题、violet/blue/cyan/rose 强调色，以及最大 4MB 的全局背景图片；背景可穿透标题栏和各玻璃表面
- 默认桌面窗口调整为 1060×700，最小尺寸 760×520；连接编辑面板继续使用固定操作区、中段滚动与低高度响应式规则
- 完成真实渲染检查：单/双面板切换、明暗主题切换、双面板两列布局与横向溢出均符合预期

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（16 tests）
- `bun run build`
- `bun run tauri build --debug --no-bundle`

**下一步:**

- Phase 2 将第二面板从预留态接入独立会话/路径状态，并实现跨面板复制与移动

### Session #008 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | UI 实用性重构 + 原生标题栏修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 定位标题栏交互失效根因：`core:default` 不包含 minimize、toggle_maximize、close 与 start_dragging 权限，且前端吞掉了调用错误
- 为四项原生窗口权限增加回归测试并补齐 Tauri capability；拖动改为单一 `startDragging()` 事件路径，排除按钮区域
- 标题栏从 68px 压缩到桌面 46px，移除版本、副标题和装饰性状态元素
- 参照用户提供的旧版界面，将 Bento 展示页重构为固定主机侧栏 + 文件工作区；主机标签筛选、选中、连接、编辑和删除均保持可操作
- 新建/编辑连接面板改为固定头部与底部操作栏，仅中间表单滚动；WebDAV 扩展字段不再把按钮推出视口
- 在 1200×800 和 800×600 下完成浏览器截图与尺寸测量；800×600 下 WebDAV 面板 568px 高、底部按钮完整可见且页面无横向溢出

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（16 tests）
- `bun run build`
- `bun run tauri build --debug --no-bundle`

**下一步:**

- 由用户在当前桌面会话内确认标题栏手感；后续 Phase 2 页面沿用紧凑双栏结构，不恢复展示型 Bento 首页

---

### Session #007 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | UI 框架重设计 + 视觉基线定稿 |
| **参与者** | 用户 + AI |

**完成事项:**

- 建立冷灰瓷白、墨黑与紫蓝强调色组成的 Modern Minimalist 视觉系统，并统一字体、间距、阴影、焦点与状态规范
- 关闭系统 decorations，新增合并式自定义标题栏，将品牌、页面位置、活动连接和窗口控制收敛到单层导航
- 将主机首页重构为非对称 Bento 工作区：主操作 Hero、连接/安全指标卡、响应式主机卡片与完整空状态
- 将文件浏览页重构为统一工作台：路径与操作合并、选择状态、现代化虚拟列表、拖放反馈和传输进度浮层
- 统一主机编辑、密码、确认/输入弹窗、右键菜单与 Toast 的组件语言和进入/状态动画
- 加入页面、卡片、弹窗、连接脉冲与进度过渡，并支持 `prefers-reduced-motion`
- 通过真实浏览器截图验收 1200×800、800×600 与 390×844 三种视口，无横向溢出；修复纯浏览器预览下 Tauri 窗口 API 的惰性加载兼容

**验证:**

- `bun run lint`
- `bun run format`
- `bun run test`（15 tests）
- `bun run build`
- `bun run tauri build --bundles nsis`（EXE + NSIS）

**已知事项:**

- WiX MSI bundler 本次在 `light.exe` 阶段失败；主程序和 NSIS 安装包正常产出，UI 与 Tauri 配置验证不受影响

**下一步:**

- 以本次视觉系统为 Phase 2 页面基线，实现远程编辑、跨协议传输和设置面板，禁止重新引入重复标题栏或旧式通用灰蓝组件

---

### Session #006 — 2026-07-15

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **类型** | 编译修复 + Phase 1 完成 |
| **参与者** | 用户 + AI |

**完成事项:**

- 系统化复现并修复前端构建错误：Toast Provider children、虚拟列表 API、Node 类型依赖、协议枚举值与运行时字段漂移
- 修复 ts-rs 导出根路径和事件载荷导出，移除手工占位类型，恢复 Rust → TypeScript 单一真理源
- 修复完整协议 feature 编译；补齐 WebDAV 命名空间 XML、实体引用、自闭合目录、UTF-8 URL 解码、Basic Auth 全请求覆盖和 TLS 校验
- 默认启用 SFTP/WebDAV adapter；SFTP 加入 KeepAlive 与递归目录删除
- 打通下载/上传进度事件，补充连接状态事件、健康检查和自动重连
- 完成 Shift/橡皮筋多选、dnd-kit 目录拖拽移动、文件选择上传、平台下载目录、150+ 文件图标映射
- 增加统一 AppError 展示、组件测试和 WebDAV 回归测试；修复配置明文密码可能落盘的问题

**验证:**

- `bun run build`
- `bun run lint`
- `bun run test`（15 tests）
- `cargo check --features protocol-adapters`
- `cargo test --features protocol-adapters`
- `cargo test --test export_types`
- `bun run tauri:build`（MSI + NSIS）

**下一步:**

- 进入 Phase 2：远程编辑、跨协议传输与设置功能补全

---

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

### ADR-012 — crate-type 桌面开发期仅 rlib（已废弃）

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-14 |
| **状态** | ⚪ 已废弃（MSVC 环境恢复后不再需要） |
| **决策者** | AI |

**背景:** GNU ld 链接 cdylib 时 `export ordinal too large`（Tauri 依赖符号过多超出 GNU ld 限制）。

**决策:** `[lib] crate-type = ["rlib"]`（桌面开发期）。移动端构建时追加 `["staticlib", "cdylib"]`。

**理由:** 桌面端 `cargo test`/`tauri dev` 仅需 rlib；cdylib/staticlib 是 Android/iOS 专用。

**影响:** 2026-07-15 已恢复 `staticlib` / `cdylib` / `rlib` 完整基线，MSVC 全 feature 构建通过。

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

### ADR-014 — 文件浏览状态按面板索引隔离

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** 原 `browserStore` 只保存一份路径、文件和选择状态，第二面板只能渲染静态占位；复用同一状态会导致任一侧导航或刷新覆盖另一侧。

**决策:** 浏览状态固定保存两个 `BrowserPaneState`，所有目录、排序、选择和文件操作显式接收 `PaneIndex`；全局只保留当前活动面板、传输状态和跨面板共享消息。

**理由:** 面板隔离是独立主机浏览、双向传输和后续跨协议操作的前置条件，同时避免为每个面板复制一套组件和 store。

**影响:** `BrowserPage` 成为面板索引驱动的可复用组件；标题栏刷新、状态栏统计和左侧主机打开动作跟随活动面板。

---

### ADR-015 — 跨主机传输由双面板拖拽驱动

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-15 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** 双面板已经能够分别绑定活动连接，继续保留右键“传输到…”与独立 TransferBrowserDialog 会形成两套目标选择和传输交互。

**决策:** 废弃 TransferBrowserDialog；工作区共享单个拖拽上下文。同主机落点调用 `move_file`，不同主机落点调用协议无关的 `transfer_entry`，两者均在落下后显示目标路径二次确认。

**理由:** 目标面板和目录在拖拽时已经可见，直接操作更符合双面板文件管理器心智模型，并减少重复 UI。后端仍只经 `SessionManager` 和 `FileTransport` trait 调度，不感知具体协议。

**影响:** Phase 2 任务 2.9 废弃；2.8/2.10 完成。当前跨主机目录传输使用本地临时文件逐项中转，传输进度统一进入底部状态栏。

---

### ADR-016 — 设备绑定密码与跨设备 Vault 分层加密

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-18 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** Windows Credential Manager 保护的主密钥适合本机保存密码，但复制 `enc.v1` 或现有加密导出文件到另一设备后无法解密；后续 Windows 与 Android 需要通过 WebDAV 同步配置和已保存密码。

**决策:** 本地 `enc.v1` 保持不变；跨设备备份使用独立 `vault.v1`。随机 Vault Key 加密设置载荷，用户备份密码经 Argon2id 派生包装密钥保护 Vault Key；新设备恢复后立即使用自己的平台主密钥重加密。WebDAV 固定保存到 `/SY-TFM/sy-tfm-vault.sytfm`，上层只调用 `FileTransport` trait。

**理由:** 分层后日常连接继续享受系统凭据库的无感保护，云端只获得端到端加密密文；备份密码不上传，也不需要改变现有主机模型的本地安全语义。

**影响:** 新增 Vault Key 系统凭据条目、便携数据模型、revision 冲突检查和 WebDAV 自动同步。完整配置、TOFU 指纹和背景图片均随保险库迁移；首次在新设备恢复仍需手动提供 WebDAV 引导凭据和备份密码。

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
| 0.8 | 实现 AppSettings 配置读写 + 迁移逻辑（v1→v3） | ✅ | P0 | 4h | ~3h | 0.7 | migrate_v1_to_v3 实现 + 单元测试 |
| 0.9 | 实现 SecretProtector 加密模块（AES-256-GCM + keyring） | ✅ | P0 | 6h | ~3h | 0.7 | 加解密实现 + 3 单元测试，编译通过 |
| 0.10 | 实现 i18next 国际化框架（EN + ZH） | ✅ | P1 | 3h | ~1h | 0.1 | i18next + react-i18next + en/zh locale |
| 0.11 | 配置 GitHub Actions CI（桌面端构建） | ✅ | P1 | 3h | ~1h | 0.4 | frontend/rust/build 三 job + 类型一致性检查 |
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
| 1.1 | 实现 SftpAdapter（russh）— 完整 FileTransport trait | ✅ | 0.6 | 12h | — | 默认 feature 启用，完整 trait 实现 |
| 1.2 | 实现 WebDavAdapter（reqwest）— 完整 FileTransport trait | ✅ | 0.6 | 12h | — | 认证、TLS、文件操作完整 |
| 1.3 | 实现 WebDAV PROPFIND XML 解析（quick-xml） | ✅ | 1.2 | 4h | — | 命名空间、实体、UTF-8 回归测试 |
| 1.4 | 实现 SessionManager（会话增删查改，trait 对象调度） | ✅ | 1.1, 1.2 | 4h | — | trait 对象统一调度 |
| 1.5 | 实现 connection 命令层 | ✅ | 1.4 | 4h | — | 状态事件已接通 |
| 1.6 | 实现密码提示对话框（前端组件） | ✅ | 0.10 | 3h | — | PasswordPromptDialog |
| 1.7 | 实现 HostList + HostCard 组件 | ✅ | 1.5, 1.6 | 6h | — | 列表卡片交互完成 |
| 1.8 | 实现 HostEditDialog | ✅ | 1.7 | 4h | — | SFTP/WebDAV 配置完成 |
| 1.9 | 实现 get_supported_protocols 命令 | ✅ | 0.5 | 2h | — | 仅返回首版协议 |
| 1.10 | 实现 list_directory + navigate 命令 | ✅ | 1.4 | 4h | — | 原子导航完成 |
| 1.11 | 实现 FileList 组件（虚拟列表 + 能力驱动列显示） | ✅ | 1.10 | 8h | — | TanStack Virtual + capability 位标志 |
| 1.12 | 实现 Breadcrumb 面包屑路径栏 | ✅ | 1.11 | 6h | — | 路径导航完成 |
| 1.13 | 实现 download/upload 命令 + 进度事件 | ✅ | 1.4 | 8h | — | adapter 通道转 Tauri 事件 |
| 1.14 | 实现 delete/create/move/rename 命令 | ✅ | 1.4 | 4h | — | SFTP 递归目录删除 |
| 1.15 | 实现 DownloadBar 进度条组件 | ✅ | 1.13 | 4h | — | 实时字节进度 |
| 1.16 | 实现 UploadZone 拖拽上传（dnd-kit） | ✅ | 1.13 | 6h | — | 外部拖入 + 文件选择上传 |
| 1.17 | 实现 ConfirmDialog + InputDialog | ✅ | 0.10 | 3h | — | 含组件测试 |
| 1.18 | 实现 ContextMenu 右键菜单 | ✅ | 1.14, 1.17 | 4h | — | 文件与主机右键操作入口 |
| 1.19 | 实现文件列表排序 | ✅ | 1.11 | 4h | — | 目录优先、多列升降序 |
| 1.20 | 实现 FileIcon 图标映射（150+ 类型） | ✅ | — | 4h | — | 分组覆盖 250+ 扩展名 |
| 1.21 | 实现橡皮筋多选（桌面端） | ✅ | 1.11 | 6h | — | Ctrl/Shift/框选 |
| 1.22 | 实现拖拽移动文件 | ✅ | 1.14, 1.21 | 4h | — | dnd-kit 多文件目录移动 |
| 1.23 | 实现 Zustand stores | ✅ | — | 6h | — | connection/browser/settings |
| 1.24 | 实现 TanStack Query 集成 | ✅ | 1.23 | 4h | — | QueryClientProvider 接入 |
| 1.25 | 实现统一错误处理中间件 | ✅ | — | 4h | — | AppError 统一格式化 |
| 1.26 | 实现 Toast 通知系统 | ✅ | — | 2h | — | sonner Provider |
| 1.27 | 实现 KeepAlive + 断连重连逻辑 | ✅ | 1.4 | 6h | — | SSH keepalive + 30s 健康检查 |
| 1.28 | 编写 Rust 单元测试 | ✅ | 1.1-1.4 | 8h | — | crypto/migration/WebDAV/type export |
| 1.29 | 编写前端组件测试（Vitest） | ✅ | 1.23 | 4h | — | 组件与工具测试 15 项 |
| 1.30 | 桌面端 MVP 集成测试 | ✅ | 全部 | 4h | — | 完整 feature 编译、构建与测试门禁 |

---

### 3.3 Phase 2 — 桌面端功能补全（第 5-7 周）

| # | 任务 | 状态 | 依赖 | 预估 | 实际 | 备注 |
|---|------|------|------|------|------|------|
| 2.1 | 实现 FileWatcher 服务（notify crate） | ✅ | 1.4 | 6h | — | 目录监听 + 500ms 防抖 |
| 2.2 | 实现 edit_remote_external 命令 | ✅ | 2.1 | 6h | — | start/stop remote edit + 系统默认应用 |
| 2.3 | 实现 EditSessionManager | ✅ | 2.2 | 4h | — | 替换、断开失效与临时文件清理 |
| 2.4 | 实现 OnlineEditor 组件（CodeMirror 6） | ✅ | — | 8h | — | 独立懒加载 Glass 编辑窗口 |
| 2.5 | 实现编辑器工具栏 | ✅ | 2.4 | 4h | — | 保存、状态、语言与路径信息 |
| 2.6 | 实现语法高亮自动检测 | ✅ | 2.4 | 4h | — | language-data 按文件名动态加载 |
| 2.7 | 实现 editor:synced/error 事件处理 | ✅ | 2.3 | 3h | — | 状态栏反馈与面板刷新 |
| 2.8 | 实现跨协议传输命令（本地中转） | ✅ | 1.4 | 8h | — | 双面板拖拽触发，目录递归中转 |
| 2.9 | 实现 TransferBrowserDialog 组件 | ⚪ | 2.8 | 8h | — | 被双面板拖拽交互取代 |
| 2.10 | 实现传输面板独立连接状态管理 | ✅ | 2.8 | 4h | — | 复用两个独立 BrowserPaneState 与活动连接 |
| 2.11 | 实现 SettingsWindow 设置面板 | ✅ | — | 8h | — | 通用/外观/存储/关于四分区完成 |
| 2.12 | 实现主题切换 | ✅ | 2.11 | 4h | — | 明暗主题已接入 |
| 2.13 | 实现强调色选择器 | ✅ | 2.11 | 4h | — | 十套亮暗强调色已接入 |
| 2.14 | 实现背景图片设置 | ✅ | 2.11 | 4h | — | 全局背景可穿透标题栏 |
| 2.15 | 实现"关于"信息面板 | ✅ | 2.11 | 2h | — | 名称、版本、开发者、许可证与 GitHub |
| 2.16 | 实现配置导出/导入（HostDto） | ✅ | 0.8 | 4h | — | AES-256-GCM 加密文件导入导出 |
| 2.17 | 实现配置备份与恢复 | ✅ | 2.16 | 4h | — | 设置中心接入原生文件选择器 |
| 2.18 | 实现标签筛选主机列表 | ✅ | 1.7 | 3h | — | 公共玻璃下拉筛选 |
| 2.19 | 实现下载路径三级解析 | ✅ | 0.8 | 2h | — | 主机路径 → 全局路径 → 系统 Downloads/SY-TFM |
| 2.20 | 实现路径栏就地编辑 | ✅ | 1.12 | 3h | — | 双击和显式编辑按钮均可用 |
| 2.21 | 实现复制路径状态反馈 | ✅ | 1.12 | 2h | — | 按新交互统一进入状态栏 |
| 2.22 | 实现窗口置顶 | ✅ | — | 2h | — | 标题栏切换并持久化 |
| 2.23 | 实现自定义标题栏 | ✅ | — | 6h | — | 合并原生标题栏、页面位置与连接状态 |
| 2.24 | 实现错误 overlay 自动消失 | ⚪ | 1.25 | 2h | — | 被统一状态栏错误反馈取代 |

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
| 4.10 | 过渡动画 | ✅ | 4h | — | 页面、卡片、浮层、状态与 reduced-motion |
| 4.11 | 桌面端自定义标题栏完善 | ✅ | 4h | — | 无边框窗口与合并标题栏 |
| 4.12 | 移动端手势动画优化 | ⬜ | 6h | — | |
| 4.13 | 空状态设计 | ✅ | 3h | — | 主机与目录空状态统一完成 |
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
| 5.3 | 应用图标制作（五平台） | ✅ | 4h | — | 透明 1024×1024 源图生成 Tauri 全套资源 |
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
| P1 | 2026-07-14 | 本机无 MSVC link.exe，Rust 默认工具链无法链接 | 全部 Rust 编译 | ✅ 已解决 | MSVC 工具链恢复并完成验证 | 2026-07-15 |
| P2 | 2026-07-14 | GNU ld 链接 cdylib export ordinal 溢出 | cargo test/build | ✅ 已解决 | 切回 MSVC 并恢复完整 crate-type | 2026-07-15 |
| P3 | 2026-07-14 | 项目路径含空格致 windres 失败 | cargo test | ✅ 已解决 | CARGO_TARGET_DIR 设无空格路径 | 2026-07-14 |
| P4 | 2026-07-14 | ts-rs 11 不支持 bitflags! derive(TS) | AdapterCapability | ✅ 已解决 | 改用 transparent newtype + type="number" | 2026-07-14 |
| P5 | 2026-07-14 | ts-rs 11 移除 transparent 属性 | AdapterCapability | ✅ 已解决 | 改用 type = "number" | 2026-07-14 |
| P6 | 2026-07-14 | ts-rs export() → export_all() API 变更 | export_types 测试 | ✅ 已解决 | 改用 export_all() | 2026-07-14 |
| P7 | 2026-07-14 | Rust 测试运行时 STATUS_ENTRYPOINT_NOT_FOUND | cargo test 运行 | ✅ 已解决 | MSVC 测试二进制正常运行 | 2026-07-15 |
| P8 | 2026-07-14 | ts-rs 无法运行时导出类型 | TS 类型生成 | ✅ 已解决 | 修正导出根路径并自动生成全部类型 | 2026-07-15 |
| P9 | 2026-07-15 | WebDAV quick-xml API/命名空间导致全 feature 编译与解析失败 | WebDAV | ✅ 已解决 | local_name + GeneralRef + Empty 事件处理和回归测试 | 2026-07-15 |
| P10 | 2026-07-15 | WiX light.exe 在 MSI 最终打包阶段失败 | Windows MSI | 🟡 监控 | 主程序正常；NSIS bundle 验证通过，后续单独排查 WiX 环境 | — |
| P11 | 2026-07-15 | 自定义标题栏不可拖动且窗口按钮无响应 | 桌面窗口 | ✅ 已解决 | 补齐 Tauri window 权限、增加配置回归测试并改为显式 startDragging | 2026-07-15 |
| P12 | 2026-07-15 | 全局弹窗被 host sidebar 的 transform 与 overflow 限制 | 全局弹窗 | ✅ 已解决 | 使用 React Portal 统一挂载至 document.body 并增加回归测试 | 2026-07-15 |
| P13 | 2026-07-15 | Portal 弹窗无法继承 app-shell 内的强调色变量 | 全局弹窗主题 | ✅ 已解决 | 将主题、accent 与 surface token 提升至 html 根作用域 | 2026-07-15 |
| P14 | 2026-07-15 | 主机删除缺少上下文入口与二次确认 | 主机侧栏 | ✅ 已解决 | 删除移至卡片悬浮及主机右键菜单并统一 ConfirmDialog | 2026-07-15 |
| P15 | 2026-07-15 | keyring 未启用平台 backend，主密钥落入 mock 且每次调用变化 | 密码保存与 SFTP 连接 | ✅ 已解决 | 启用原生凭据 feature、系统安全随机源及写后回读稳定性校验 | 2026-07-15 |
| P16 | 2026-07-15 | 文件右键菜单在 transform 容器中使用视口坐标，造成横向偏移和边缘裁切 | 文件浏览右键菜单 | ✅ 已解决 | 菜单 Portal 到 body，并按真实尺寸在视口边缘四向翻转 | 2026-07-15 |
| P17 | 2026-07-15 | 双面板复用单例浏览状态，第二侧仅为静态占位 | 桌面文件浏览 | ✅ 已解决 | 浏览状态按两个 PaneIndex 隔离，面板主机选择只显示活动连接 | 2026-07-15 |
| P18 | 2026-07-15 | SFTP 所有者缺失且权限显示为 755 等数字 | 文件元数据 | ✅ 已解决 | user/group 优先、uid/gid 回退并转换符号权限字符串 | 2026-07-15 |
| P19 | 2026-07-15 | 拖拽自动滚动与最近目标算法造成面板扩张、错误目录命中且移动无确认 | 文件拖拽 | ✅ 已解决 | 禁用自动滚动、使用 pointerWithin、DragOverlay 和目标目录二次确认 | 2026-07-15 |
| P20 | 2026-07-15 | 每个文件面板各自创建 DnD 上下文，导致拖拽预览坐标偏移且不能跨面板 | 双面板拖拽 | ✅ 已解决 | 工作区共享 DndContext，DragOverlay Portal 到 body，目录命中显示落点提示 | 2026-07-15 |
| P21 | 2026-07-15 | 目录下载被当作普通文件读取并返回 Failure | 文件下载 | ✅ 已解决 | 后端按 RemoteFile 类型递归 list/download 并创建本地目录树 | 2026-07-15 |
| P22 | 2026-07-15 | 主机切换时迟到的旧请求覆盖新面板路径/home | 双面板状态 | ✅ 已解决 | BrowserPaneState 绑定 hostId，异步提交前验证面板所有权 | 2026-07-15 |
| P23 | 2026-07-15 | Windows OpenSSH 反斜杠路径无法拆分面包屑 | 路径栏 | ✅ 已解决 | 路径规范化、父级与拼接逻辑同时支持 POSIX/Windows | 2026-07-15 |
| P24 | 2026-07-16 | 虚拟列表 transform 与 dnd-kit 测量坐标系不一致，目录落区无法命中且预览偏移 | 文件拖拽 | ✅ 已解决 | 虚拟行改用真实 top 定位、目录落区优先碰撞、固定指针预览 | 2026-07-16 |
| P25 | 2026-07-16 | 面板分配依赖最后活动侧，断开/折叠后会遗留空白面板 | 双面板状态 | ✅ 已解决 | 纯函数确定性分配、断开协调与折叠提升，并增加四组回归测试 | 2026-07-16 |
| P26 | 2026-07-16 | 语言状态已变化但大量界面文案硬编码，导致中英文切换看似无效 | 全局界面 | ✅ 已解决 | 全部可见文案接入 i18next，并以键镜像与源码扫描测试阻止回归 | 2026-07-16 |
| P27 | 2026-07-16 | 通知组件固定白色背景，在暗黑主题中形成白底浅字 | 全局通知 | ✅ 已解决 | 通知消费主题与玻璃 token，并补齐明暗主题样式回归测试 | 2026-07-16 |
| P28 | 2026-07-16 | 配置导入后主机数据已落盘但列表未刷新，看似未恢复 | 配置导入 | ✅ 已解决 | 导入完成同时 hydrate settings 与重新加载 connection hosts | 2026-07-16 |
| P29 | 2026-07-16 | 主机栏 class 拼接失效、单面板主机激活无效且第二连接触发第一面板重载 | 主机与双面板状态 | ✅ 已解决 | 独立 class token、显式主机激活分配与 capability 原始值依赖 | 2026-07-16 |
| P30 | 2026-07-16 | WebDAV 以主机/端口建模导致带路径认证 URL 无法正确填写和组合 | WebDAV 连接 | ✅ 已解决 | URL 优先表单、HTTP scheme 枚举、地址路径与 base path 安全合并 | 2026-07-16 |
| P31 | 2026-07-16 | Windows 盘符路径复制结果多出前导斜杠 | 路径栏 | ✅ 已解决 | 复制前通过统一远程路径规范化器移除 `/C:\\` 前导符 | 2026-07-16 |
| P32 | 2026-07-16 | 表头位于滚动区外，数据行位于滚动区内，固定列随滚动条宽度产生整体偏移 | 文件列表 | ✅ 已解决 | 表头移入同一滚动容器并 sticky，表头与行共享唯一 grid 列令牌 | 2026-07-16 |
| P33 | 2026-07-16 | 小字号分散写死且 Owner/Permissions 表头继承到不同颜色和字重 | 全局排版 | ✅ 已解决 | 五级字体令牌、可调设置、统一表头样式与 Windows 中文字体栈 | 2026-07-16 |
| P34 | 2026-07-16 | dnd-kit 滚动修正位移与虚拟列表重测量叠加，预览在普通文件上方远离指针 | 单/双面板拖拽 | ✅ 已解决 | 使用窗口级 clientX/clientY 定位预览，文件行阻断面板落区、目录行独占有效落区 | 2026-07-16 |
| P35 | 2026-07-16 | 递归下载的每个子文件完成事件都会提前结束整批状态，导致加载动画反复重启 | 下载状态 | ✅ 已解决 | 批次完成由发起流程统一管理，新增目录文件计数事件并展示速度 | 2026-07-16 |
| P36 | 2026-07-16 | SessionManager 在网络 await 期间持有全局会话表读锁，卡住的传输阻塞断开所需写锁 | 会话与全部远程操作 | ✅ 已解决 | 会话改为 Arc 快照并在 await 前释放表锁，断开先摘除会话再关闭 adapter | 2026-07-16 |
| P37 | 2026-07-16 | 上传下载复用单例进度且每 64 KiB 阻塞推送 WebView，造成任务覆盖、界面卡顿和低吞吐 | 并发传输与状态栏 | ✅ 已解决 | operationId 独立任务、256 KiB 流式缓冲、非阻塞进度与 100ms 事件节流 | 2026-07-16 |
| P38 | 2026-07-16 | 子文件字节进度被直接当成任务总进度，导致多文件与中转阶段显示 100% 后归零 | 传输状态栏 | ✅ 已解决 | 按任务项与中转阶段映射单调进度，100% 仅由完整任务成功流程写入 | 2026-07-16 |
| P39 | 2026-07-17 | 固定状态栏高度与未约束完成图标导致传输卡片越界，Online Edit 同步提示过重 | 状态栏 | ✅ 已解决 | 高度随数据字号受控适配、子项裁切，并将在线编辑同步收敛为左侧单行状态 | 2026-07-17 |
| P40 | 2026-07-17 | SessionManager 与 adapter 仅判断对象是否存在，心跳断线后前端仍显示在线 | 连接状态同步 | ✅ 已解决 | SFTP Handle/WebDAV PROPFIND 真实探测、代次安全清理、5 秒后端监控事件与前端自动恢复 | 2026-07-17 |
| P41 | 2026-07-17 | 批量传输取消等待目录操作、进度继续变化且禁用按钮触发系统 wait 指针 | 传输取消与状态栏 | ✅ 已解决 | 远程操作参与取消竞争、取消态冻结进度、局部 spinner 替代 wait cursor | 2026-07-17 |
| P42 | 2026-07-17 | 已取消任务满足通用失败条件，导致状态栏连接数量被错误标红 | 传输状态与状态栏 | ✅ 已解决 | 增加独立取消结果语义，错误色判断仅接受真正失败的传输 | 2026-07-17 |
| P43 | 2026-07-17 | 重复 Remote Edit 会销毁旧 watcher 并重新下载，已关闭编辑器的有效监听也无重新打开入口 | Remote Edit | ✅ 已解决 | 按主机与远程路径复用会话，并在路径栏提供当前连接有效监听列表 | 2026-07-17 |
| P44 | 2026-07-18 | 生产下载链路残留 panic、占位图标以及崩溃后的 Remote Edit 临时目录无法回收 | Windows 发布基线 | ✅ 已解决 | 可恢复错误、五平台透明图标与跨进程租约保护的启动清理 | 2026-07-18 |
| P45 | 2026-07-18 | Remote Edit UUID 仅位于父目录，系统编辑器中无法区分不同远程目录下的同名文件 | Remote Edit | ✅ 已解决 | 保留完整 UUID 目录，并在源文件名后追加 UUID 后 8 位 | 2026-07-18 |
| P46 | 2026-07-18 | WebDAV 缺少 Depth 导致递归列出整棵树，服务根 href 又被重复拼接造成子目录 404 | WebDAV | ✅ 已解决 | 显式有限 Depth、服务 href 逻辑化与直属子项防御过滤 | 2026-07-18 |
| P47 | 2026-07-18 | 连接提示仅临时覆盖旧 operationMessage，连接完成后 Remote Edit 失效消息再次出现 | 状态栏 | ✅ 已解决 | 新连接生命周期清除旧 notice，并忽略重连期间的迟到失效事件 | 2026-07-18 |
| P48 | 2026-07-18 | 主机列表只能按配置创建顺序展示，无法拖放或精确调整顺序 | 主机面板 | ✅ 已解决 | dnd-kit 拖排、悬浮上下按钮与后端 ID 顺序原子持久化 | 2026-07-18 |
| P49 | 2026-07-18 | Ctrl+A 触发 WebView 默认整页文本选择而非文件管理器全选语义 | 桌面交互 | ✅ 已解决 | 活动面板文件全选、编辑控件豁免与应用壳层文本选择抑制 | 2026-07-18 |
| P50 | 2026-07-19 | 直接复制 EXE 仍会落到系统 AppData，无法形成可控的绿色版数据根 | Windows 便携分发 | ✅ 已解决 | 同级标记启用 `data/` 根目录；敏感凭据仍须经加密保险库恢复 | 2026-07-19 |
| P51 | 2026-07-19 | 便携 EXE 启动后只有后台进程，隐藏主窗口始终不显示 | Windows 启动 | ✅ 已解决 | 移除隐藏 WebView 上不会稳定执行的双层 animation frame，React 挂载后立即调用原生 show | 2026-07-19 |
| P52 | 2026-07-19 | 重复执行 EXE 会创建多个独立 Tauri runtime 与主窗口 | 桌面进程生命周期 | ✅ 已解决 | 桌面端首个插件注册 single-instance；后续启动只还原并聚焦现有窗口 | 2026-07-19 |

---

## 5. 里程碑追踪

| 里程碑 | 所属阶段 | 目标日期 | 实际日期 | 状态 | 备注 |
|--------|----------|----------|----------|------|------|
| M0.1 — `tauri dev` 可启动 | Phase 0 | — | 2026-07-15 | ✅ | MSVC 构建链恢复 |
| M0.2 — Lint 检查通过 | Phase 0 | — | 2026-07-15 | ✅ | |
| M0.3 — 枚举目录 + ts-rs 同步 | Phase 0 | — | 2026-07-15 | ✅ | 自动生成占位文件已移除 |
| M0.4 — FileTransport trait 就绪 | Phase 0 | — | 2026-07-14 | ✅ | |
| M0.5 — 配置读写 + 迁移 | Phase 0 | — | 2026-07-15 | ✅ | 含明文密码升级 |
| M0.6 — 密码加密测试通过 | Phase 0 | — | 2026-07-15 | ✅ | |
| M0.7 — CI 桌面端构建 | Phase 0 | — | 2026-07-15 | ✅ | |
| M1.1 — SFTP + WebDAV adapter 完成 | Phase 1 | — | 2026-07-15 | ✅ | 默认启用完整 adapter |
| M1.2 — 文件浏览 + 操作可用 | Phase 1 | — | 2026-07-15 | ✅ | |
| M1.3 — 桌面端 MVP 可用 | Phase 1 | — | 2026-07-15 | ✅ | 自动化质量门禁通过 |
| M2.1 — 远程编辑可用 | Phase 2 | — | 2026-07-17 | ✅ | Online Edit + Remote Edit |
| M2.2 — 跨协议传输可用 | Phase 2 | — | 2026-07-15 | ✅ | 双面板拖拽 + 本地临时文件递归中转 |
| M2.3 — 桌面端功能完整 | Phase 2 | — | 2026-07-18 | ✅ | Windows v1.0.0 自动化基线；实机矩阵持续补充 |
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
| v1.1 | 2026-07-15 | 完成 Phase 1，更新任务、里程碑、问题与环境状态 | AI |
| v1.2 | 2026-07-15 | 定稿 Modern Minimalist / Bento UI 框架与自定义标题栏基线 | AI |
| v1.3 | 2026-07-15 | 收敛为紧凑双栏布局并修复原生标题栏权限与连接面板响应式 | AI |
| v1.4 | 2026-07-15 | 定稿 Glassmorphism 明暗主题、强调色、全局背景与单/双面板框架 | AI |
| v1.5 | 2026-07-15 | 修复全局弹窗被局部玻璃面板限制的问题 | AI |
| v1.6 | 2026-07-15 | 统一 Portal 弹窗的玻璃主题与全局强调色交互状态 | AI |
| v1.7 | 2026-07-15 | 收紧弹窗退出策略并补齐主机右键菜单与删除确认 | AI |
| v1.8 | 2026-07-15 | 修复文件列表命中/列布局/工作目录并收紧连接表单与解密错误提示 | AI |
| v1.9 | 2026-07-15 | 修复 Windows 密码持久化并统一连接表单公共玻璃下拉组件 | AI |
| v1.10 | 2026-07-15 | 修复文件菜单定位并收紧列表、路径和类型图标体系 | AI |
| v1.11 | 2026-07-15 | 完成独立双面板、路径折叠、状态栏传输、拖拽确认与字号设置 | AI |
| v1.12 | 2026-07-15 | 完成双面板拖拽传输、递归目录下载、原生目录选择与路径竞态修复 | AI |
| v1.13 | 2026-07-16 | 修复虚拟列表拖拽与双面板分配并完成四分区设置中心 | AI |
| v1.14 | 2026-07-16 | 完成全局双语、主题通知、配置导入恢复与实际路径展示 | AI |
| v1.15 | 2026-07-16 | 完成 WebDAV URL 配置、连接测试、面板同步、表格对齐与玻璃设置联动 | AI |
| v1.16 | 2026-07-16 | 修复文件表格滚动坐标与排序，完成五级字体和 Glass 视觉回归 | AI |
| v1.17 | 2026-07-16 | 收紧文件列表密度，修复拖拽坐标并补齐批量下载计数与速度 | AI |
| v1.18 | 2026-07-16 | 完成并发可取消传输、远程操作超时、资源管理器拖入和跨面板任意落点 | AI |
| v1.19 | 2026-07-16 | 加宽双面板元数据列并修复上传与中转任务进度回退 | AI |
| v1.20 | 2026-07-16 | 修复系统外链、窗口还原状态与连接表单，并升级 russh、清理启动警告 | AI |
| v1.21 | 2026-07-17 | 完成内置高亮编辑器与外部编辑器临时文件自动同步 | AI |
| v1.22 | 2026-07-17 | 修复状态栏高度越界并收敛 Online Edit 同步反馈 | AI |
| v1.23 | 2026-07-17 | 完成真实连接健康同步、取消反馈与 Remote Edit 监听复用 | AI |
| v1.24 | 2026-07-18 | 完成 Windows v1.0.0 基线、透明图标与崩溃残留清理 | AI |
| v1.25 | 2026-07-18 | Remote Edit 临时文件增加可见 UUID 后缀与同名隔离测试 | AI |
| v1.26 | 2026-07-18 | 修复 AList WebDAV 递归列表和路径重复，并刷新高清透明图标 | AI |
| v1.27 | 2026-07-18 | 完成主机持久化排序、状态栏生命周期和 Ctrl+A 文件全选 | AI |
| v1.28 | 2026-07-18 | 修复主机拖排溢出和 Portal 文本残留，补齐右键排序与状态栏复制 | AI |
| v1.29 | 2026-07-18 | 完成主机拖排插入线、浮层指针对齐与连接副标题字号归类 | AI |
| v1.30 | 2026-07-18 | 改用 Sortable 实时排序并完善编辑类型、时间与状态栏展示 | AI |
| v1.31 | 2026-07-18 | 增加 Delete/F2 文件快捷键并统一主机拖动排序入口 | AI |
| v1.32 | 2026-07-18 | 完成 vault.v1 跨设备加密备份与 WebDAV SY-TFM 目录同步 | AI |
| v1.33 | 2026-07-19 | 修正 Vault 暂停语义、共用备份密码、同步状态栏与拖排悬浮收尾 | AI |
| v1.34 | 2026-07-19 | 修复主机点击悬浮态，拆分备份密码设置并完成 Vault 错误国际化 | AI |
| v1.35 | 2026-07-19 | 完成备份密码显式保存、改密确认与主机悬浮 CSS 根因修复 | AI |
| v1.36 | 2026-07-19 | 重设计备份密码凭据行并消除 Save 按钮横向溢出 | AI |
| v1.37 | 2026-07-19 | 将备份密码卡统一为顶部说明、字段区与底部操作区 | AI |
| v1.38 | 2026-07-19 | 修复嵌套弹窗层级并增加云端旧备份显式覆盖确认 | AI |
| v1.39 | 2026-07-19 | 完成便携运行时数据根、ZIP 构建脚本与深色橙色 NSIS 安装器皮肤 | AI |
| v1.40 | 2026-07-19 | 修复便携版隐藏窗口启动死锁并将产物统一到 Tauri bundle 目录 | AI |
| v1.41 | 2026-07-19 | 增加备份密码可视确认与桌面单实例激活行为 | AI |

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
