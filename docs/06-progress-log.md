# SY-TFM — 实时进度与决策日志

**项目名称:** SY-TFM (Tiny File Manager)  
**创建日期:** 2026-07-10  
**最后更新:** 2026-07-25
**当前阶段:** Phase 3 进行中 — Android 真机运行已验证，正在重构移动端排版

> **使用说明:** 本文档是项目的活文档（living document），每次开发会话结束后更新。  
> 顶部是快速概览，往下是详细记录。最新的内容在最上面。

---

## 0. 快速概览

### 0.1 当前状态

| 指标 | 值 |
|------|-----|
| 当前阶段 | Phase 0/1/2 已完成；Phase 3 Android 适配已启动 |
| 当前任务 | Android 主机抽屉与动态工作区尺寸、圆角和滑动反馈复核 |
| 总体进度 | 文档设计 100%，Phase 0/1 完成，Phase 2 为 22/22（2 项由新版交互取代） |
| 阻塞项 | 无；Android 首次交叉编译与调试产物已验证 |
| 文档状态 | ✅ 需求 ✅ 架构 ✅ 接口 ✅ 数据模型 ✅ 实现计划 ✅ 进度日志 |

### 0.2 当前在做

> Windows 桌面基线保持冻结；Android 已完成真机安装运行，当前按原生平台标记独立重排移动端界面。

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
| Phase 3 — 移动端适配 | 🟡 进行中 | 2/21 | 1/6 | Android 工程、调试产物与真机运行已验证；视觉适配进行中 |
| Phase 4 — 优化打磨 | ⬜ 未启动 | 0/17 | 0/5 | |
| Phase 5 — 发布准备 | 🟡 进行中 | 1/8 | 0/3 | 五平台图标资源已生成 |

> **图例:** ⬜ 未启动 / 🟡 进行中 / ✅ 已完成 / 🔴 阻塞

---

## 1. 会话日志

> 每次开发会话在此追加记录，最新在最上面。

### Session #079 — 2026-07-25

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-25 |
| **类型** | Android 主机抽屉关闭终点残影修复 |
| **参与者** | 用户 + AI |

**根因与完成事项:** 抽屉增加 8px 左右外间距后，关闭终点仍按自身宽度平移 `-100%`，其右边缘因此会停留在屏幕左侧 8px 范围内，直到收尾状态约 300ms 后切换 `visibility` 才消失。现将进度到位移的映射统一为百分比位移加按进度衰减的 8px 边缘补偿：完全打开保持 `0%`，完全关闭为 `calc(-100% - 8px)`，中间拖动连续插值；没有通过提前隐藏截断动画。

**平台隔离:** 位移样式仍位于 `html.mobile-platform`，新映射函数只由 Android 主机抽屉调用，Windows 不受影响。

**验证:** 先增加关闭、中点和打开三种位移的失败测试；专项测试 41/41 通过，`bun lint`、`bun format`、`bun test`（28 files / 180 tests）及 `bun run build` 全部通过。真机需要复核快速甩动和慢速拖动两种关闭手势。

### Session #078 — 2026-07-25

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-25 |
| **类型** | Android 主机抽屉动态尺寸与滑动表面收敛 |
| **参与者** | 用户 + AI |

**根因与完成事项:** 主机抽屉此前采用相对视口的固定定位，顶部仍写死为旧的 48px 标题栏高度，底部也独立估算状态栏与安全区；主面板则位于会随标题栏和底栏自动伸缩的工作区内，因此标题栏调矮后两者必然错位。现将抽屉改为工作区内的绝对定位，并让抽屉与主面板共用 8px 横向间距、6px 纵向间距和 14px 圆角变量，从结构上保证顶部栏、底部栏或传输状态变化时仍完全同尺寸。移除抽屉和遮罩的透明度渐变及逐帧透明度写入，遮罩保留交互层但完全透明，滑动时只绘制抽屉本体的平移。

**平台隔离:** 改动仅位于 `html.mobile-platform` 的 Android 样式规则；Windows 布局、主机侧栏尺寸和悬浮交互未修改。

**验证:** 先增加失败回归断言，再完成实现；Android 抽屉专项测试 36/36 通过，`bun lint`、`bun format`、`bun test`（28 files / 179 tests）及 `bun run build` 全部通过。圆角与四周实际间距仍需 Android 真机最终观感确认。

### Session #077 — 2026-07-25

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-25 |
| **类型** | Android 标题栏高度下限与 Vault 状态胶囊微调 |
| **参与者** | 用户 + AI |

**完成事项:** Android 顶部应用栏高度下限由 44px 调整为 32px，持久化值归一化与设置滑块同步更新；标题栏按钮和 Vault 胶囊高度改为跟随设置收缩，避免只降低容器却让 36–38px 子控件溢出。Vault 日期提升至 10–11px、启用等宽数字，并在右端增加语义状态灯：同步启用为带柔光的绿色，暂停或仅保存配置时为中性灰色。全部样式继续限制在原生 Android 规则内。

**验证:** 先增加失败回归断言，再完成实现；`bun lint`、`bun format`、`bun run test`（28 files / 179 tests）与 `bun run build` 全部通过。32px 极限高度与状态灯实际观感仍需真机复核。

### Session #076 — 2026-07-25

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-25 |
| **类型** | 编辑状态生命周期与 Android 标题栏、竖屏策略优化 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Online Edit 关闭路径只销毁编辑器组件，没有清除其写入的全局 `operationMessage`；Remote Edit 成功调用系统编辑器后又把一次性成功提示写成持久状态。现为编辑消息增加所有权比较，关闭或卸载仅清理编辑器自己发布且仍为当前值的消息，不会误删更新的连接/传输错误；在线读取与保存增加代次门禁，关闭后的异步回调不能重新写入残留状态；外部编辑成功交接后立即撤下“正在打开”，有效 watcher 继续由远程编辑会话入口呈现
- Android 底栏宽度不足以同时容纳 Vault 状态、连接状态和文件计数。现将 Vault 状态和最近同步时间移到应用标题栏中央的双行紧凑胶囊；仅 `html.mobile-platform` 隐藏底栏 Vault 元数据，Windows 继续保留原完整状态和时间
- `AppSettings` 新增向后兼容的 `mobileTitlebarHeight`（默认 48px），General 设置仅在原生 Android 显示 44–80px 调节项；CSS 高度在系统安全区之外动态计算。该设置随既有平台配置分区持久化，不改变 Windows 标题栏
- Android 生成目录被 Git 忽略，直接修改 Manifest 无法持久化。现增加版本化 `tauri.android.conf.json` 与幂等构建准备脚本，在每次 Android dev/build 前为 MainActivity 写入 `sensorPortrait`。由于 targetSdk 36 在 `sw600dp` 大屏默认忽略方向限制，同时写入 API 36 临时兼容属性；该属性在未来 targetSdk 37 不再生效，届时必须完成自适应横屏布局

**验证:** `bun run types:export`、`bun lint`、`bun format`、`bun run test`（28 files / 179 tests）、`bun run build`、`cargo fmt`、`cargo clippy --all-targets -- -D warnings` 与新增 Rust 默认值测试全部通过。Gradle `processUniversalDebugMainManifest` 输出 `BUILD SUCCESSFUL`，合并产物确认同时包含 `sensorPortrait` 与 `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`；外层 PowerShell 进程未在 120 秒工具窗口内退出而被标记超时，但 Manifest 任务本身已在 15 秒完成。Android 标题栏实际密度和高度手感仍需安装后真机复核。

### Session #075 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Android 在线编辑器零高度回归与 WebDAV 状态栏可见性修复 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 通过已连接 Android 真机的 WebView 调试端口复现：远端 `nginx.conf` 已完整进入 CodeMirror 的 `.cm-content`，但 `.cm-editor` 与 `.cm-scroller` 实测高度均为 `0px`。原因是上一轮把 scroller 改成 `flex: 1 1 0`，同时高度规则错误匹配 `.cm-theme`；`@uiw/react-codemirror` 使用的实际外层类是 `.cm-theme-dark/.cm-theme-light`，未获得确定高度。现给组件增加稳定的 `.online-editor-codemirror` 类，外层、editor 与 scroller 逐级固定为可收缩的 `100%` 高度，并恢复 scroller 自身纵向滚动。真机注入同等规则后视口恢复到约 688px，`scrollHeight` 约 4249px
- WebDAV 状态数据一直存在于 Android DOM，真机读取为 `Vault active`，但两个窄屏规则都使用 `.status-meta > span:first-child { display:none }`，恰好隐藏第一个 Vault 状态项。现用 `html.mobile-platform` 专项规则恢复云图标与当前同步状态，移动端隐藏过长的同步时间与分隔点以保留文件计数；Windows 完整状态和时间不变

**验证:** 真机 CDP 已确认修复前数据存在但编辑器高度为 0，并验证候选规则可恢复真实视口与滚动范围；新增两个先失败后通过的回归断言。`bun lint`、`bun format`、`bun run test`（28 files / 174 tests）及 `bun run build` 全部通过。完整 Android debug 构建已在 21:19:14 更新 APK，Windows Release EXE 已在 21:38:37 更新；外层命令因同一个 Gradle Java 进程未退出而被手工终止，产物写盘后已清理该残留进程。随后设备从 ADB 断开，`adb install -r` 返回 `no devices/emulators found`，因此新版 APK 安装后的最终触摸滚动与状态栏视觉仍待重新连接真机复核。

### Session #074 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Android 背景热切换、主机冲突合并、编辑器滚动与双平台刷新优化 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android 导入器一直覆盖 `selected-background.<ext>`；连续选择同扩展名图片时设置值不变，React 背景 effect 不会重跑。现原生插件边复制边计算 SHA-256，保存为 `selected-background-<digest>.<ext>` 并清理旧文件，不再依赖手动关闭/开启背景
- CodeMirror 自带的 scroller 强制 `height: 100% !important`，在嵌套 flex/grid 中按内容撑高后被外层裁切，表面上有 `overflow:auto` 仍无滚动范围。现将 scroller 改为可收缩的 `flex: 1 1 0`、`height:auto !important` 与独立纵向 overflow，覆盖鼠标滚轮和触摸平移
- 移动性能优化曾把 `.host-sidebar` 也加入全局禁用 blur 清单，导致抽屉不响应毛玻璃设置。现仅恢复抽屉自身的 `glassOpacity/glassBlur`，其余 Android 全屏层继续禁用实时模糊；Windows 样式规则未改
- 30 秒云端检查成功后曾调用带 `isLoading=true` 的 `loadHosts()`，即使数据不变也闪出加载态。现轮询使用静默 `refreshHosts()`，相同数组不替换 Zustand 状态，显式导入/首载仍保留原 loading 语义
- 共享主机由整体哈希冲突升级为“设备加密的上次快照 + 按 UUID 三方合并”：远端删除与本地新建可同时落地，两端不同 UUID 的新增取并集，删除优先于同记录离线编辑，同一 UUID 的不兼容双端修改明确报冲突；旧检查点在首次主机写入前安全迁移为 `enc.v1` 快照
- 在线编辑入口不再按扩展名提前拦截；后端下载后按 UTF-8/UTF-16 BOM 与 NUL/控制字符比例判定文本，`.bash_profile` 等无扩展名文本可编辑，二进制仍拒绝。外部 Remote Edit 的扩展名门禁保持不变
- 设置面板不再依赖不确定的 idle 懒加载，23 KiB 模块并入启动加载，首次点击与后续点击使用同一同步渲染路径。移动滑块增加透明手势保护层：只有从当前 thumb 附近开始且方向确认是横向的拖动才修改值，纵向手势交给设置页滚动

**验证:** `bun run types:export`、`bun lint`、`bun format`、`bun run test`（28 files / 174 tests）、`bun run build`、`cargo fmt`、`cargo clippy --all-targets -- -D warnings`、`cargo test`（122 单元测试 + 类型/窗口测试）全部通过。Android 原生存储插件 `compileDebugKotlin` 通过；完整 `bun run tauri android build --debug --target aarch64 --apk --ci` 成功生成 arm64 debug APK；Windows `bun run tauri build -- --no-bundle` 成功生成 Release EXE。Android 背景视觉、120 Hz 抽屉和滑块手感仍需本次 APK 真机复核。

### Session #073 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Android 背景二进制渲染、WebDAV 双向合并、编辑器滚动与设置预热 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android 私有图片路径和导入本身正确，但 Asset Protocol 仍给渲染链增加平台 scope 与 URL 转换依赖；现由 Rust 返回原始图片字节，Android WebView 创建并回收 Blob URL，Windows 继续使用既有 Data URL。背景只有在实际字节加载成功后才进入启用态，关闭时也不会让旧图片瞬间以满不透明度闪现
- 原 30 秒定时器只读取本地同步状态，不能发现 Windows/Android 的远端主机变化；现定时器执行真实 WebDAV 三方核对，并把共享主机与当前平台设置拆成两个独立指纹。不同作用域可双向合并，同一作用域两端并发变化才冲突；无变化不上传、不增加 revision
- 主机增删改仍按 1.5 秒防抖快速同步，未改变的主机保存会在写盘前直接返回。实时设置不再逐项调度同步，只在设置关闭、应用进入后台或 30 秒检查时等待写队列落盘后核对一次
- CodeMirror 宿主和 scroller 补齐 `min-height: 0`、显式滚动与触摸平移；设置对话框模块在主线程空闲时预加载，消除第一次点击时才解析约 23 KiB 独立 chunk 的冷启动停顿

**验证:** `bun run types:export`、`bun lint`、`bun format`、`bun test`（28 files / 172 tests）、`bun run build`、`cargo fmt --check`、`cargo clippy --lib -- -D warnings` 与 `cargo test --lib`（115 tests）通过。Windows Release `--no-bundle` 构建成功；Android ARM64 Release APK 构建成功，12,510,895 bytes，minSdk 31、targetSdk 36、仅 `arm64-v8a`，APK Signature Scheme v2/单签名者验证通过。当前无 ADB 设备在线，Android 背景最终视觉仍需安装本次 APK 真机复核。

### Session #072 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Android 背景 Asset Protocol scope 修复与自动同步触发审计 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 上一轮确认了 Android 应使用 Asset Protocol，但 scope 写成 `$APPDATA/backgrounds/**`。Tauri 2.11.5 在 Android 将 `$APPDATA` 解析为 `activity.dataDir`（`/data/user/0/com.sy.tfm`），项目导入插件则把图片保存到 `activity.filesDir/backgrounds`（`/data/user/0/com.sy.tfm/files/backgrounds`），因此真实文件始终被 scope 拒绝
- 新增 Android 平台覆盖配置 `tauri.android.conf.json`，仅 Android 把 Asset Protocol scope 设为 `$APPDATA/files/backgrounds/**`；基础配置与 Windows Data URL 显示流程保持不变
- 审计确认当前任何 `save_settings`、主机保存/删除/排序/导入都会调度自动同步。它不是固定周期上传，而是每次本地保存后重新开始 1.5 秒防抖；30 秒周期只刷新同步状态。防抖到期后仍会先下载云端并比较当前平台作用域，相同则不上传、不增加 revision

**验证:** 先新增回归测试并复现缺少 Android 平台 scope 配置的失败，修复后定向 8 项通过；最终 `bun run lint` → `bun run format` → `bun run test` 质量门禁通过（28 files / 170 tests）。ARM64 Android Release 构建成功，APK 为 12,521,923 bytes，仅包含 `arm64-v8a`，并通过 APK Signature Scheme v2、单签名者验证；真机背景显示仍需安装本次 APK 复核。

### Session #071 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Android 背景显示修复与 WebDAV 背景资源增量拆分 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android Photo Picker 已正确把图片导入 `/data/user/0/.../files/backgrounds`，但界面仍让 Rust 把整张图片编码为超长 Data URL，再经 IPC 回传并注入 CSS；大图在 Android WebView 链路上无法可靠生效。现仅在原生移动平台用 Tauri `convertFileSrc` 读取应用私有路径，Asset Protocol scope 严格限制为 `$APPDATA/backgrounds/**`，Windows 继续使用原有本地路径读取流程
- 云端 schema v2 的平台条目确实把背景原始字节 Base64 内嵌进加密主文件，带来约 33% 编码膨胀，且任何主机/平台配置变动都会重新上传整张图片。schema v3 改为只保存背景文件名、平台资源名、SHA-256 和原始大小，图片单独 gzip 为 `background-windows-<sha256>.gz`、`background-android-<sha256>.gz` 等内容寻址文件
- 主配置改为明文 JSON 先 gzip、再 AES-256-GCM；加密后再压缩没有收益。`vault.v1` 增加可选 `payloadEncoding=gzip`，没有该字段的旧未压缩文档继续兼容读取
- 同步时背景摘要与远端索引相同且压缩包存在则不重复上传；缺失时只补传资源，不制造空配置 revision。恢复时限制解压后大小并验证原始大小和 SHA-256，schema v2 内嵌背景会在下一次同步迁移为独立平台资源

**验证:** 定向前端回归 20 项通过；最终 `bun run lint` → `bun run format` → `bun run test` 质量门禁通过（28 files / 170 tests），`cargo fmt --all`、`cargo clippy --lib -- -D warnings` 与 `cargo test --lib`（113 tests）通过。`bun run tauri android build --target aarch64 --apk --ci` 成功，生成 12,521,919 bytes 的 ARM64 Release APK，并通过 APK Signature Scheme v2、单签名者校验。当前无 ADB 设备在线，Android 私有背景的最终显示与 WebDAV 实服资源拆分仍需真机复核。

### Session #070 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Android 抽屉动画、背景图 URI、原生文本输入与性能诊断 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android 抽屉逐帧拖动本身已使用 CSS 变量，但松手时 `open`、`dragging` 和变量清理跨 React/rAF 时序竞争，快速滑动可能直接跳到终态；现增加 280ms 独立 settling 状态，从当前实际进度连续过渡到目标位置，期间拒绝新手势，完成后再清理合成层变量
- Android 路径栏主机菜单由 184px 继续收紧为 164px；Windows 保持 196px 与桌面纯图标连接操作，不受本次移动端宽度修改影响
- Photo Picker 返回没有文件扩展名的 `content://` URI，旧逻辑却用 `Path::extension` 和 `std::fs` 读取；输入失焦与选择回调还会并发重复校验。现由 Android 原生 `ContentResolver` 按 MIME 流式导入不超过 20MB 的图片到应用私有目录，设置只保存稳定路径；Android 输入框只读并取消失焦提交，错误提示由 i18n 统一输出，不再泄露 Rust 中文硬编码
- 全局 `contextmenu.preventDefault()` 原本连 Android 输入框一起拦截，导致系统选择、复制、剪切菜单消失；现只在 Android 可编辑控件内放行原生菜单，并阻止抽屉手势从文本控件开始
- 主机/WebDAV/备份密码输入补齐语义 form、`id/name/autocomplete`，Android WebView 显式设置 `IMPORTANT_FOR_AUTOFILL_YES`；密码管理器仍会把 Tauri WebView 识别为 `tauri.localhost`，候选展示取决于具体 Autofill 服务
- 用户快照的 `TOTAL PSS` 为约 99MB，不能用 237MB RSS 作为独占内存；Java+Native 私有堆不足 7MB，主要为系统共享映射与图形内存。Android 静态主界面现关闭大面积实时 `backdrop-filter`，减少滚动和高刷新率下的 GPU 重栅格化，Windows 玻璃效果不变

**验证:** 前端定向回归 57 项通过，最终 `bun run lint` → `bun run format` → `bun run test` 质量门禁通过（28 files / 168 tests）；`bun run build`、`cargo fmt --check`、`cargo clippy --lib -- -D warnings` 与 `cargo test --lib`（108 tests）通过。Android storage 插件和 MainActivity Kotlin 编译通过；首次 App 资源任务曾遇到本机 Gradle `appcompat-1.7.1` 转换缓存的 AAPT2 PNG 瞬时异常，随后完整 `bun run tauri android build --target aarch64 --apk --ci` 成功。生成 Release APK 为 12,421,663 bytes，APK Signature Scheme v2、单签名者验证通过。当前无 ADB 设备在线，抽屉手感、Photo Picker、Bitwarden 候选及温度/帧率仍需新 APK 真机复核。

### Session #069 — 2026-07-24

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **类型** | Windows 紧凑主机菜单、Android 离线资源诊断、WebDAV 增量同步 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Windows `Choose host` 菜单在文字按钮移除后仍保留 248px 宽度和 76px 操作位；现收紧为 196px，连接/断开改为带 `title`/`aria-label` 的 30px 纯图标按钮，Android 184px 菜单保持原生平台隔离
- `assets not found: index.html` 来自 528MB 开发调试产物：该 Rust 调试库不嵌入生产前端资源，离开 `tauri android dev` 的前端服务后不能作为离线 APK 重开；重新生成的 12.4MB arm64 Release APK 已验证 v2 签名有效，且 Rust 库内包含本次 `dist` 的 JS/CSS 资源
- WebDAV 手动同步原本每次无条件增加 revision 并上传，同时把其他平台单独提高的 revision 当成冲突；现为每个本机平台缓存“共享主机 + 当前平台分区”的 SHA-256 指纹，仍先下载云端并做本地/云端/缓存三方比较
- 当前平台作用域相同则不上传、不增加 revision，只采用云端检查点；其他平台独立变化而当前平台云端作用域仍等于缓存时，可安全保留对方平台数据并合并本平台改动；共享主机或当前平台发生并发变化时仍拒绝覆盖
- 旧配置没有作用域指纹时采用保守兼容策略；首次内容一致比较、恢复、首次启用或成功上传后自动建立缓存

**验证:** `bun run types:export`、`cargo fmt --check`、`cargo clippy --lib -- -D warnings`、`cargo test --lib`（108 tests）、`bun run lint`、`bun run format`、格式化后再次 `bun run lint`、`bun run test`（28 files / 165 tests）及 `bun run build` 全部通过。arm64 Release APK 位于 `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`（12,416,687 bytes），通过 APK Signature Scheme v2 校验，并确认嵌入当前前端入口 JS/CSS；真机启动仍需人工安装验证。

### Session #068 — 2026-07-23

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-23 |
| **类型** | 双平台主机菜单、WebDAV 凭据草稿与平台隔离云同步 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 路径栏主机菜单仍沿用桌面 292px / Android 224px 固定宽度，短名称和地址会留下大面积无效空间；现分别收紧为 248px / 184px，桌面继续保留连接/断开操作位，移动端改动仍由 `html.mobile-platform` 原生标记隔离
- 全局状态栏每 30 秒刷新一次 Vault 状态；设置页收到新状态后无条件把尚未保存的 WebDAV URL、用户名覆盖为后端旧值，首次配置时即清空。Windows 与 Android 共用该轮询，因此两端都存在风险；现为凭据草稿记录逐字段编辑状态，轮询只填充未编辑字段，密码和已输入内容不再被后台状态刷新影响
- WebDAV 云端载荷升级为 schema v2：顶层仅共享主机连接数据，每主机下载目录与其余 `AppSettings`、背景图片按 Rust `Platform` 分区；同步先解密并合并云端分区，只替换当前平台，恢复缺少当前平台条目时使用平台默认设置并恢复共享主机
- 本地便携导入/导出继续保留完整单设备配置，不被 WebDAV 分区策略改变；旧云端 schema v1 没有平台身份，不能可靠归属外观和路径，因此只迁移可证明共享的主机，下一次同步自动写为 schema v2
- 云端恢复继续保持 `enabled=false`，不会因恢复操作自动开启同步

**验证:** `cargo fmt`、`cargo clippy --lib -- -D warnings`、`cargo test --lib`（105 tests）、`bun run lint`、`bun run format`、格式化后再次 `bun run lint`、`bun run test`（28 files / 164 tests）及 `bun run build` 全部通过。新增轮询不覆盖编辑草稿、双平台菜单宽度、平台分区合并、缺省恢复及旧 schema 迁移测试；Android/Windows WebDAV 实服往返仍需人工验证。

### Session #067 — 2026-07-23

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-23 |
| **类型** | Android/Windows 平台默认字号与双平台 Select 字体等级修复 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Windows 的五档默认字号原本为正文 13px、标题 15px、标签 12px、提示 11px、数据 12px，实际样式与设置值一致；Android 原生样式却以 `!important` 将其中多档强制放大，导致卸载重装后的显示值与设置页不一致，且对应滑杆无法真正控制界面
- 移除 Android 对全部排版令牌的 CSS 强制覆盖，并在 Rust 配置默认值中通过原生目标显式区分平台：Android 首次无配置时使用 15/20/14/11/13，Windows 继续保持 13/15/12/11/12；已有用户配置在两端均按保存值原样生效
- 设置在 React 首帧渲染前完成加载，避免 Android 启动时短暂套用前端桌面占位默认值；`App` 内不再重复加载设置
- 通用 Select 的主文字历史上固定为 10px、说明文字固定为 8px，绕过五级字体令牌；现分别绑定 `--type-body-size` 与 `--type-caption-size`，Interface language 及其他通用选择器在 Windows/Android 均遵循字体等级
- Windows 默认提示字号未发生同类偏差，仍为 11px；共享修复只将原先过小的 Select 主文字恢复到正文等级，Android 平台默认值通过 Rust 目标判定隔离，未改变 Windows 的五档默认值

**验证:** `cargo fmt --check`、`cargo clippy --lib -- -D warnings`、`cargo test --lib`（102 tests）、`bun run lint`、`bun run format`、格式化后再次 `bun run lint`、`bun run test`（27 files / 160 tests）及 `bun run build` 通过；新增 Android 五档字号无 CSS 覆盖、首帧预加载、双平台默认值及 Select 主/次文字等级映射断言。Android/Windows 最终视觉比例仍需双端人工复核。

### Session #066 — 2026-07-23

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-23 |
| **类型** | Android 抽屉性能与手势边界、双平台主机凭据布局 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android 路径栏主机下拉继承了桌面为连接/断开按钮扩展的 292px 信息宽度；移动端没有这些操作却仍覆写为 280px，现仅在原生移动平台收紧为 224px，Windows 继续保留 292px 操作空间
- 路径栏下方按钮带的横向触摸会冒泡到 `app-shell` 全局抽屉手势；现为该原生移动滚动区增加抽屉手势排除标记与 `pan-x` 触摸策略，横向浏览操作按钮不再拉出主机抽屉
- 主机抽屉拖动原先每次 `touchmove` 都更新 `AppInner` 顶层 React state，从而反复协调整个工作区组件树；现只在手势开始/结算时改变 React 状态，逐帧进度由 `requestAnimationFrame` 合并后直接更新 CSS 变量，并使用 `translate3d` 合成层完成位移
- 仓库与生成 Android Activity/Manifest 未发现 90Hz 限制或刷新率偏好配置；120Hz 设备实际降到 90Hz 的具体原因仍需结合系统刷新率指示器、电池/性能模式和 WebView 帧时间在真机确认，不能仅凭 release/debug 类型归因
- 添加/编辑主机的用户名/密码列比例由 6:6 改为 5:7；该项按需求同时作用于正常 Windows 桌面宽度和原生 Android 表单，极窄的非移动桌面窗口仍保留逐行响应式布局
- Android 专项菜单宽度、手势排除与抽屉渲染路径继续由 `html.mobile-platform` 或运行时原生平台信号隔离；Windows 只共享明确要求的凭据字段比例调整

**验证:** `bun run lint`、`bun run format`、格式化后再次 `bun run lint`、`bun run test`（27 files / 157 tests）及 `bun run build` 通过；新增 Android 菜单宽度、操作带手势排除、抽屉无逐帧 React state 更新和双平台 5:7 字段比例断言。Android 120/90Hz 显示模式与抽屉实际帧时间仍需新 release APK 真机复核。

### Session #065 — 2026-07-23

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-23 |
| **类型** | Windows 路径栏连接管理与 Android 弹层手势互斥 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Windows 路径栏主机选择器原先由 `App` 传入预过滤后的 `connectedHosts`，组件层无法展示未连接主机；现桌面端读取全部保存主机，每项仅保留一个连接/断开操作，连接中显示忙碌态
- 断开当前主机会卸载浏览面板，若侧栏同时隐藏便会失去重连入口；现 Windows 空面板路径栏继续挂载同一主机控件，可直接连接任意保存主机并打开对应面板
- 路径栏和主机侧栏原先各自实现连接密码、解密失败重试及 SFTP TOFU 确认；现抽取 `useHostConnectionFlow` 作为唯一流程，避免两个入口产生安全或行为差异
- Android 全局抽屉手势原先只排除文件拖动，React Portal 挂载的下拉、设置、确认框等弹层不会阻止主界面手势；现所有 Portal 统一标记活动遮罩，抽屉触摸开始、移动及结束阶段均检查门禁
- 锚定下拉原先只监听桌面 `mousedown`，Android 点击主面板空白或在下拉中滑动时无法可靠收起；现使用捕获阶段 `pointerdown` 处理所有指针，并在原生移动平台触摸位移超过阈值时关闭
- Windows 全主机连接操作仅在非 `mobile-platform` 分支渲染；Android 仍只显示已连接主机且不增加连接按钮，移动端新增逻辑仅为弹层手势门禁和触摸关闭

**验证:** `bun run lint`、`bun run format`、格式化后再次 `bun run lint`、`bun run test`（27 files / 155 tests）及 `bun run build` 通过；Windows 全主机/空面板连接入口与 Android Portal 手势隔离均有自动化断言。Windows 实际下拉尺寸、Android 真机触摸关闭及各类系统弹层叠加效果仍需双端人工确认。

### Session #064 — 2026-07-23

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-23 |
| **类型** | 全平台拖放反馈与 Android 全局抽屉、面板及表单收敛 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 当前目录拖放提示原先插入滚动容器并使用内描边，会参与滚动尺寸计算、触发滚动条且被表头/圆角裁切；现改为脱离布局的半透明模糊背景覆盖层和文字提示，不再绘制边框或改变盒子尺寸
- Windows 普通文件行原先仅作为 `blocked` 落点阻止父面板命中，`drag-end` 又直接丢弃该类型；现普通文件行同时携带所在面板当前目录，落在文件上会按目标面板当前路径进入传输确认
- Android 标题栏与主机侧栏原先各维护一套抽屉触摸状态；现统一提升为 `app-shell` 原生移动平台全局手势，整个应用区域实时左右拖动开关抽屉，并移除标题栏主机按钮和局部重复处理器
- Android 连接后“双层盒子”并非同时存在两个面板组件，而是 `browser-page` 外壳内边距与内部工具栏/文件区边框叠加；现由单一外壳负责圆角和表面，内部区域取消重复边框与圆角
- Android 主机编辑表单在通用窄屏规则下被强制逐项换行；现仅在 `html.mobile-platform` 下恢复 12 列比例：名称/标签 8:4、地址/端口 8:4、用户名/密码 6:6，协议标题与选择器同排
- Android 主机抽屉底边改为跟随 38px/72px 状态栏实际占位并叠加底部安全区，列表增加底部滚动留白，避免末项被状态栏遮挡
- 共享变更仅包含当前目录拖放语义与提示样式；抽屉、单层面板、表单和安全区均由 `html.mobile-platform` 或原生平台判定显式隔离，Windows 标题栏、主机表单和侧栏布局未改动

**验证:** `bun run format`、`bun run lint`、`bun run test`（27 files / 152 tests）与 `bun run build` 通过；Windows/Android 自动化平台隔离断言通过，Android 全局手势、系统安全区及双端视觉效果仍需新 APK/Windows 实机人工确认。

### Session #063 — 2026-07-22

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-22 |
| **类型** | Android 实时抽屉手势、紧凑操作栏与跨平台滚动保持 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 主机抽屉原先只在 `touchend` 判断方向，没有拖动过程状态；现将触摸位移映射为 0–1 连续进度，抽屉与遮罩随手指逐帧移动，并在松手时按方向和中点阈值停靠
- 标题栏原先在抽屉打开时直接拒绝手势；现标题栏左半区在关闭状态右拖打开、打开状态左拖关闭，主机面板自身左拖关闭使用同一进度与结算规则
- Android 主机抽屉改为完整覆盖标题栏与状态栏之间的工作区，移除外层 8px 空隙、边框、圆角和阴影，不再露出无连接空面板
- Android 文件操作带由纵向 48px 弹性卡片收紧为 34px 图标+文字横排按钮，保持横向滚动并减少无效留白
- 文件刷新不再卸载文件列表 DOM，因此 Android 与 Windows 均原位保留滚动位置；只有远程路径实际变化时才在布局阶段无动画归顶
- Android 专项交互和样式继续由 `html.mobile-platform` 显式隔离；Windows 仅共享刷新滚动保持逻辑，桌面布局与手势未修改

**验证:** `bun run format`、`bun run lint`、`bun run test`（27 files / 151 tests）与 `bun run build` 通过；应用内浏览器无法访问 Windows 本机回环预览，Android 真机触摸手感与 Windows 人工视觉回归待新 APK 验证。

### Session #062 — 2026-07-22

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-22 |
| **类型** | Android 拖放阈值、一体化文件面板与全宽主机抽屉 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android 目录碰撞原先只要求提示矩形与目录相交；现按提示框自身面积计算覆盖率，严格超过 50% 才显示目录落点提示
- Android 路径区与文件区从两张独立圆角卡合并为一个连续面板：路径工具区仅保留顶部圆角，文件标题栏取消圆角，横向滚动操作带维持原触控风格
- 主机抽屉扩展为与主面板相同的左右 8px 间距；主机卡片改为 44px 图标、清晰主副标题和三等分 42px 文字操作带
- Android 主机抽屉支持左滑关闭；关闭时可从标题栏左半区右滑打开，水平距离与轴向比例共同过滤正常纵向滚动
- Windows 与 Android 文件滚动容器在表头高度绘制同色底层，并将滚动条轨道透明化，消除滚动条占位造成的表头右侧空白
- Windows 主机卡片默认光标由 grab 手形恢复为普通箭头；实际拖动中的 grabbing 状态保留

**验证:** `bun run format`、`bun run lint`、`bun run test`（27 files / 147 tests）与 `bun run build` 通过。

### Session #061 — 2026-07-22

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-22 |
| **类型** | Android 双面板矩形拖放与移动界面状态收敛 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 纠正 Session #060 的错误建模：落点不再是提示框底边附近的单点，而是与屏幕上文件名提示完全一致的矩形
- Android 碰撞检测先按提示框矩形的重叠率选定上/下面板，再只在该面板内选择目录；空白区域明确映射到该面板当前目录，消除下方向上拖动时误命中另一面板末尾目录的问题
- 面板当前目录增加整区高亮和文字提示；同主机显示移动，跨主机显示复制，目录行提示同步区分移动/复制
- Android 路径工具区、文件滚动区和表头统一圆角边界；标题栏操作按钮移除残留的 hover/active/expanded 状态填充
- Android 活动传输状态栏改用自适应两行高度，覆盖桌面固定 flex basis，避免传输卡片顶部被裁切
- Windows 继续使用原有 pointerWithin 与桌面状态样式；平台隔离由源码回归测试覆盖，尚待 Windows/Android 实机视觉复核

**验证:** `bun run format`、`bun run lint`、`bun run test`（27 files / 141 tests）与 `bun run build` 通过；ARM64 debug APK 已生成并通过 APK Signature Scheme v2 校验。

### Session #060 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 双面板文件拖动落点统一 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- Android 文件名提示位于手指左上方，但 dnd-kit 碰撞检测仍使用手指坐标，导致视觉提示进入另一面板时 `event.over` 仍命中原面板目录
- 新增统一移动端落点：文件名提示底边中央下方 6px；目录高亮、面板识别和最终放置均使用该坐标
- Windows 继续使用鼠标原始坐标，桌面拖放行为不变

### Session #059 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 拖动定位坐标修复 |
| **参与者** | 用户 + AI |

**根因与完成事项:**

- 主机拖动 Overlay 原先位于带 `transform` 的移动 drawer 内，fixed 定位因此错误地以 drawer 为包含块；现仅在 Android 拖动期间通过 Portal 挂载到 `document.body`，恢复 dnd-kit 所需的视口坐标系
- Android 文件拖动名称提示从触点右下方改到左上方 14px，避免被手指遮挡；Windows 保留原鼠标右下提示位置

### Session #058 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 拖动、操作带、触摸选择与公共下载目录修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- Android 主机排序浮层改为继承激活卡片的真实尺寸，避免长按激活时预览突然跳到手指下方；桌面排序行为不变
- 将刷新、上传补回 Android 文件操作带，并保留基于选择的文件操作
- 在移动平台事件边界禁用桌面橡皮筋框选，同时增加 `pointercancel` 清理，避免残留高亮选区
- 新增 Android 专用 MediaStore 插件：下载先写入应用私有暂存区，再发布到公共 `Download/SY-TFM`；未申请失效的旧存储权限或受限的全盘访问权限

**验证:** `bun lint`、`bun run format`、`bun test`（138 项通过）、桌面 `cargo check`、arm64 Android debug APK 构建均通过。

### Session #057 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 文件选择操作带、触摸拖动反馈与移动表格重构 |
| **参与者** | 用户 + AI |

**根因:**

- Android 右键菜单被屏蔽后没有替代操作入口；文件选择仍沿用桌面 Ctrl/Shift 语义，缺少可发现的多选方式
- 触摸拖动启动事件不是 `MouseEvent`，导致文件拖动预览坐标为空；主机排序没有移动 Overlay，源卡片只在原位降低透明度
- 移动端最后声明的 hover 清理规则覆盖了选中背景，仅留下桌面选中态的左侧指示线
- 面包屑编辑按钮仍参与 flex 流；Owner/Permissions 仍由能力位驱动显示，没有移动端列裁剪
- 将目录拖到自身/子目录时前端主动发布错误状态，而该无效落点更适合静默忽略

**完成事项:**

- Android 路径栏下新增可横向滑动的选择操作带：下载、重命名、删除、新建文件、新建文件夹、在线编辑；操作按选择数量与文件类型启停
- 移动端隐藏 Remote Edit 会话入口，Windows Remote Edit、右键菜单与原有路径操作保持不变
- 文件行及表头增加 Android 复选框，支持显式多选/全选；选中行恢复完整强调色背景
- Android 文件表格固定为复选框 + Name（含类型图标）+ Size + Modified，隐藏 Owner/Permissions
- 路径编辑按钮改为路径胶囊右侧绝对定位；文件触摸拖动补齐 TouchEvent 坐标和实时名称预览
- Android 主机排序使用 DragOverlay 展示实际移动卡片，原位置源卡片在拖动期间隐藏
- 目录拖到自身或子目录时直接忽略，不再产生错误状态

**验证:**

- `bun lint`、`bun format`、`bun test`（26 files / 138 tests）通过
- Android 选择操作、复选框、三列布局、触摸预览、主机 Overlay 与平台隔离回归测试通过
- TypeScript/Vite 生产构建与 ARM64 Android debug APK 重建通过

### Session #056 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 路径栏、主机操作、触摸拖拽与状态栏修复 |
| **参与者** | 用户 + AI |

**根因:**

- 移动端仍把主机选择、完整面包屑和桌面操作按钮挤在同一行，主机名与路径编辑入口相互压缩
- 主机操作依赖桌面 `hover` 才显示；主机与文件拖动只注册 PointerSensor，Android 长按同时进入应用右键菜单流程
- 空的传输状态节点仍占据移动状态栏第二个网格列，使连接数与文件数被排到不同行
- 标签筛选器外层字号已放大，但内部 `strong` 仍命中桌面 10px 规则

**完成事项:**

- Android 路径工具栏改为上下两层：首层固定保留主机选择与圆角路径胶囊，路径胶囊增加明确的触摸编辑按钮；第二层均匀排列文件操作
- Android 主机卡片的编辑、连接/断开、删除按钮改为常显触控目标；桌面仍保持悬浮显示
- 主机排序和文件拖动在 Android 触摸上改用 320ms 延迟 TouchSensor；Windows 与其他指针继续使用原 PointerSensor，Android 长按不再打开应用右键菜单
- 放大 All Tags 当前值与下拉选项字号/行高，并限制长列表为可滚动高度
- 移动状态栏隐藏空传输列，连接数与文件数固定在同一网格行；活动传输单独占下一行
- 新增 Android 路径、触摸拖拽、操作按钮与状态栏平台隔离回归测试

**验证:**

- `bun lint`、`bun format`、`bun test`（26 files / 136 tests）通过
- TypeScript/Vite 生产构建与 ARM64 Android debug APK 构建通过
- APK：`src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

### Session #055 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android Keystore 持久化与云端恢复语义修复 |
| **参与者** | 用户 + AI |

**根因:**

- `keyring 3.6.3` 没有 Android backend；Android target 自动落入仅单个 `Entry` 生命周期有效的 mock store，导致每次操作生成不同设备主密钥
- 设置页保存 Backup Password 后会清空输入框，Restore 随后读取本机密文；旧 mock 主密钥无法再次取得，因此错误被归类为“密码错误或备份损坏”
- Restore 后端显式写入 `enabled: true`，错误地把一次性本地恢复变成了自动同步启用操作

**完成事项:**

- 新增项目内 `plugins/secure-storage` Tauri Android 插件：使用 Android Keystore 中不可导出的 AES-GCM Key 加密 SharedPreferences 内的设备主密钥和 Vault Key
- Android 不再编译或调用 `keyring` mock backend；Windows/macOS/Linux/iOS 保持原有 `keyring` 原生实现不变
- 同步状态现在会实际验证本机受保护密码是否可读；旧 Android mock 密文显示为未保存，引导用户重新输入，而不再误报云端文件损坏
- 从云端恢复后保存 WebDAV/Vault 元数据但保持 `enabled = false`；仅显式点击启用/恢复同步才会上传
- 同步修正 AGENTS 与架构文档中的平台密钥存储说明

**验证:**

- `bun lint`、`bun format`、`bun test`（26 files / 133 tests）通过
- `cargo fmt --check`、Rust lib 101 tests、Clippy `-D warnings` 通过
- Android Keystore Kotlin 插件、ARM64 Rust 库、debug APK 与 AAB 完整构建通过

### Session #054 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 移动排版重构与桌面隔离回归 |
| **参与者** | 用户 + AI |

**完成事项:**

- 移除 Android 标题栏硬编码的 28px 顶部留白，改为仅消费真实安全区；标题栏压缩为 48px 内容高度并清除桌面分组边框与竖分隔线
- 未选择主机时移除占满屏幕的容器边框与冗余路径栏，将空状态改为靠上、使用移动正文比例的轻量引导区
- 主机 Drawer 收窄至最多 310px，缩短筛选器和主机行触控高度，同时提高主机副文本可读性，改善内容密度
- 主机新增/编辑弹窗按动态视口垂直居中；底部测试、取消、创建/保存保持同一行，连接测试结果改为浮在操作栏上方
- 设置中心改为顶部横向分类导航和单列内容卡；WebDAV 与其他长文本操作按钮改为移动端全宽排列，允许安全换行且不再横向溢出
- 新增空状态语义类和平台隔离断言；所有视觉覆盖继续限定在 `html.mobile-platform`，Windows 仅获得无样式副作用的语义 class

**验证:**

- `bun lint`、`bun format`、`bun test`（26 files / 131 tests）全部通过
- TypeScript/Vite 生产构建通过；平台隔离测试确认 Android 样式仍依赖 Rust 原生移动平台信号
- ARM64 Android debug APK 与 AAB 重建成功，真机视觉待用户复验

### Session #053 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 平台隔离、安全区与存储路径修复 |
| **参与者** | 用户 + AI |

**完成事项:**

- 修正仅按 767px 断点启用移动壳层的错误，改由 Rust `cfg!(mobile)` 原生判定注入平台标记；Android 专项样式不再进入 Windows
- Android viewport 启用 `viewport-fit=cover`，标题栏按安全区 inset 增加顶部空间，Drawer 与遮罩同步避让系统状态栏
- 移动触屏覆盖桌面 hover 视觉，清除点击后粘滞的位移、滤镜、背景与阴影状态，同时保留 selected/pressed 语义
- Tauri 启动时注入 `app_data_dir`，Android 设置与路径查询不再依赖不支持移动端的 `directories::ProjectDirs`
- 在 AGENTS.md 增加“平台适配零回归”硬约束：必须原生平台隔离，禁止只按视口宽度推断平台

**验证:**

- Windows 前端 lint、TypeScript/Vite 生产构建通过；平台隔离与桌面启动专项测试 27/27 通过
- Rust 单元测试 101/101 通过；ARM64 Android debug APK 重建成功
- 完整 `bun test` 仍仅受已知 Bun 1.3.14 Tauri 插件解析问题阻塞，其余 119 项通过


### Session #052 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android 移动壳层与自适应图标首轮适配 |
| **参与者** | 用户 + AI |

**完成事项:**

- Android 窄屏壳层改为移动文件台：简化标题栏，增加主机 Drawer 入口，保留刷新、主题、设置与单双面板控制
- 主机列表在移动端改为遮罩式 Drawer；选择主机后自动收起
- 双面板在移动端由左右并排改为上下堆叠，不再隐藏第二面板；移动端提高正文字号、数据字号与触控目标尺寸
- Android 启动器图标增加 72% 安全区留白；重新构建后 APK manifest 已使用 `mipmap-anydpi-v26/ic_launcher.xml` 自适应图标

**验证:**

- `bun format`、`bun lint`、前端 TypeScript/Vite 生产构建通过
- ARM64 debug APK 成功生成，APK 仅包含 `arm64-v8a` 原生库；待 Android 12+ 真机视觉与交互验收
- `bun test` 保持已知的 Bun 1.3.14 对 Tauri 插件顶层 `exports` 解析失败，Node 22 可解析相同依赖；与本次改动无关


### Session #051 — 2026-07-19

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **类型** | Android Phase 3 初始化与平台基线调整 |
| **参与者** | 用户 + AI |

**完成事项:**

- 已生成 Tauri Android 原生工程，并安装 `aarch64-linux-android` Rust target
- 根据用户明确的本地 SDK 基线，将 Android 最低支持版本从 API 26 提升为 Android 12（API 31）
- 同步更新项目权威约束、需求文档、Tauri 持久化配置与本机生成的 Android Gradle 配置
- 使用项目的橙色应用源图重新生成全平台图标，并重新初始化 Android 工程，修复 Android 工程误用 Tauri 默认启动器图标的问题

**验证:**

- 前端 Vite 生产构建通过
- 已在本地成功完成 Android Rust 交叉编译，生成通用 debug APK 与 AAB；尚未进行真机安装验证
- 已生成 ARM64 release APK；该文件未签名，`apksigner` 验证确认无法安装，待配置用户自管 Android keystore 后重新构建
- `bun lint` 与 `bun format` 通过；`bun test` 被 Bun 1.3.14 对 `@tauri-apps/plugin-dialog` / `@tauri-apps/plugin-opener` 的顶层 `exports` 解析失败阻塞。Node 22 可解析相同依赖，确认与本次 Android 配置无关。

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

**影响:** 新增 Vault Key 系统凭据条目、便携数据模型、revision 冲突检查和 WebDAV 自动同步。完整配置、TOFU 指纹和背景图片的云端归属后续由 ADR-019 收紧为“主机共享、其余按平台分区”；首次在新设备恢复仍需手动提供 WebDAV 引导凭据和备份密码。

---

### ADR-017 — Android 最低版本设为 Android 12（API 31）

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** 项目原先声明 Android 8（API 26）为最低版本，但用户本地 Android SDK 的可用最低平台为 Android 12（API 31），且明确选择不再覆盖 Android 8–11。

**决策:** Android 应用通过 `bundle.android.minSdkVersion` 将 `minSdk` 设为 31；项目文档与本机生成的 Android Gradle 工程保持一致。

**影响:** Android 8–11（API 26–30）设备无法安装后续 APK。Android 12 及更高版本成为本项目的最低 Android 支持基线。

---

### ADR-018 — 平台专项适配必须原生隔离且零回归

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-19 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** Android 首轮适配仅以视口宽度启用移动壳层，导致窄窗口 Windows 同时获得 Android 标题栏、Drawer 和字号覆盖，破坏既有桌面基线。

**决策:** 平台专项功能必须先通过 Rust 编译目标或 Tauri 原生平台能力判定，再叠加响应式断点；视口宽度只负责同一平台内的布局变化，不得承担平台识别。任何专项适配必须验证目标平台与至少一个既有平台不发生回归。

**影响:** 前端由后端 `cfg!(mobile)` 注入移动平台标记；Android 样式只能在该标记下生效。后续 iOS、Android 文件系统、系统栏、生命周期与触控交互均遵循同一隔离规则。

---

### ADR-019 — WebDAV 云端设置按平台分区

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-23 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** Windows 与 Android 的屏幕、路径和视觉参数不同；把完整 `AppSettings` 当作一份全局配置同步会让一端的字号、背景、下载目录等覆盖另一端。旧云端载荷也没有记录设置来源平台。

**决策:** WebDAV 解密载荷升级为 schema v2，顶层只共享 `RemoteHost` 中的远端连接数据；每主机下载目录及其余设置和背景图片按 `Platform` 保存。同步采用“读取—解密—合并—写回”，更新共享主机和当前平台分区，保留其他平台分区。恢复缺少当前平台分区时使用平台默认值。旧 schema v1 只迁移主机连接数据并清除未标记平台的下载目录，避免猜测设置归属。本地便携备份保持完整单设备语义。

**理由:** 主机连接资料具备跨平台价值，而界面、路径、窗口与背景天然属于运行平台。显式平台键比路径或设备特征推断可靠，也符合平台适配零回归约束。

**影响:** Windows/Android 后续同步互不覆盖外观和路径；首次从旧 v1 云端恢复仅获得主机与当前平台默认设置，下一次同步创建当前平台分区。外层 `vault.v1` 加密格式、Vault Key、备份密码和 WebDAV 固定路径不变。

---

### ADR-020 — WebDAV 使用平台作用域指纹进行增量同步

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** schema v2 已按平台隔离设置，但同步仍无条件上传并增加 revision；任一平台更新也会让其他平台因云端 revision 较新而冲突，无法区分“共享/本平台数据变化”和“只有其他平台变化”。

**决策:** 每个设备在本地用 `lastSyncedHostsHash` 与 `lastSyncedPlatformHash` 分别缓存共享主机和当前 `Platform` 条目的 SHA-256 指纹，保留 `lastSyncedScopeHash` 兼容旧检查点。同步下载并解密云端文档后，对两个作用域分别做三方比较：本地等于检查点则拉取远端，远端等于检查点则推送本地，两个不同作用域允许在同一轮双向合并，只有同一作用域两端同时变化才返回冲突。上传 revision 以本机和云端较大值为基准递增。

**理由:** 只比较整份 schema v2 会把 Android 条目变化误判为 Windows 变化；只比较本地缓存又无法发现远端并发修改。平台作用域三方比较同时满足无变化零上传、跨平台互不干扰和共享数据冲突保护。

**影响:** 重复点击 Sync now 不再制造空 revision；其他平台新增/修改主机可由 30 秒检查自动拉取，同时保留本平台独立外观变化。主机变更 1.5 秒快速触发，设置项只在设置关闭、应用进入后台或周期检查时核对。旧配置通过组合指纹迁移独立指纹，无法证明基线时保持保守冲突。缓存仅为不可逆 SHA-256，不保存云端明文。

---

### ADR-022 — WebDAV 配置与平台背景资源分离压缩

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** schema v2 把平台背景原始字节转换为 Base64 后内嵌进加密配置，单张约 6 MiB 的图片会令 `.sytfm` 增长到约 8 MiB；任何主机或平台设置更新都会重新加密并上传图片。Android 本地显示还通过同样的 Data URL/IPC 路径搬运整图，路径虽已稳定但大图无法可靠显示。

**决策:** WebDAV schema 升级为 v3。加密主文件只保存共享主机、平台设置及背景资源索引，平台图片以内容寻址的 `background-<platform>-<sha256>.gz` 独立存放。索引包含安全文件名、远端资源名、SHA-256 与原始大小；背景路径不进入云端。更新时先上传新资源、再提交配置、最后清理旧资源。配置明文 JSON 在 AES-256-GCM 前做 gzip，文档用可选 `payloadEncoding` 标识；旧未压缩 `vault.v1`、schema v2 内嵌背景和 schema v1 主机迁移路径继续保留。

**理由:** 密文不可有效压缩，因此压缩必须发生在加密前。资源分离后，主机变化只上传很小的配置文件；背景只有摘要变化或远端文件缺失时才上传。图片本身不按敏感配置加密，但其摘要和引用仍在认证加密的配置里，恢复时可检测篡改。

**影响:** `/SY-TFM` 不再只有 `sy-tfm-vault.sytfm`，设置过背景的平台会出现自己的 `.gz` 文件；正常提交后每个平台仅保留当前摘要对应的一个压缩包，失败重试窗口可能暂存新旧两个。JPEG/PNG 等本身已压缩格式的 gzip 体积收益可能有限，但不会再产生 Base64 膨胀或重复上传。Android 界面通过原始二进制 IPC 创建短生命周期 Blob URL，Windows 背景继续使用 Data URL，平台渲染链路互不影响。旧客户端不能理解 schema v3 的资源索引，新客户端仍可读取旧云端和旧便携备份。

---

### ADR-021 — Android Photo Picker 媒体立即导入应用私有存储

| 项目 | 内容 |
|------|------|
| **日期** | 2026-07-24 |
| **状态** | ✅ 已接受 |
| **决策者** | 用户 + AI |

**背景:** Android Photo Picker 返回 `content://` URI，既没有可靠文件扩展名，也不是 Rust `std::fs` 可访问的路径；直接持久化 URI 还会把临时授权生命周期带入启动与云同步流程，造成选择后无反应、重开设置才报错等不确定行为。

**决策:** 前端只把 Photo Picker URI 作为一次性导入句柄。Android 原生存储插件使用 `ContentResolver` 获取 MIME 并流式复制到应用私有 `files/backgrounds`，限制 20MB 和已支持图片类型；成功后 `AppSettings.backgroundImagePath` 只保存复制后的稳定路径。桌面普通文件路径保持原流程，Android 不为背景图片申请媒体库或全盘存储权限。

**理由:** 立即复制消除 URI 授权、扩展名与重启生命周期差异，同时使现有 Rust 图片读取、便携备份及 WebDAV 平台分区序列化继续只处理普通文件。相比长期持有 URI 权限，应用私有副本的删除、替换与安全边界更明确。

**影响:** Android 每次选择背景会替换上一个私有背景副本；原始媒体删除或设备重启不影响已经导入的背景。旧配置若遗留不可读 `content://` 不再触发失焦重复报错，用户重新选择后即迁移到稳定路径。

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
| 3.1 | 初始化 Tauri Android 项目 | ✅ | 0.1 | 4h | — | `src-tauri/gen/android` 已生成；最低版本为 API 31 |
| 3.2 | 初始化 Tauri iOS 项目 | ⬜ | 0.1 | 4h | — | |
| 3.3 | 验证 russh + reqwest 移动端交叉编译 | ✅ | 0.6 | 6h | — | 已生成通用 debug APK 与 AAB；真机运行仍待验证 |
| 3.4 | 实现移动端密钥存储 | ⬜ | 0.9 | 6h | — | |
| 3.5 | 实现移动端文件系统适配 | ⬜ | 0.8 | 4h | — | |
| 3.6 | 实现 ResponsiveLayout 响应式布局 | 🟡 | 0.12 | 6h | — | 移动标题栏、字号与上下双面板首轮完成，待真机验收 |
| 3.7 | 实现 MobileTabBar 底部导航 | ⬜ | 3.6 | 4h | — | |
| 3.8 | 实现 Drawer 侧栏抽屉 | 🟡 | 3.7 | 4h | — | 主机 Drawer 首轮完成，待真机交互验收 |
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
| P53 | 2026-07-19 | Android 路径栏被桌面操作挤压，长按触发右键菜单且状态栏空列造成错行 | Android 文件浏览交互 | ✅ 已解决 | 两层移动路径栏、常显主机操作、延迟 TouchSensor、移动右键抑制与显式状态网格区域 | 2026-07-19 |
| P54 | 2026-07-19 | Android 禁用右键后缺少文件操作入口，触摸拖动无预览且表格仍显示桌面列 | Android 文件选择与操作 | ✅ 已解决 | 选择驱动操作带、显式复选框、三列移动表格、TouchEvent 预览与主机 DragOverlay | 2026-07-19 |
| P55 | 2026-07-22 | Android 文件提示与碰撞几何不一致，跨上下双面板空白落点会误命中另一面板目录 | Android 双面板拖放 | ✅ 已解决 | 完整提示矩形碰撞、面板优先仲裁、当前目录高亮与跨主机复制提示 | 2026-07-22 |
| P56 | 2026-07-22 | Android 目录边缘接触即高亮、路径与列表割裂，移动主机操作目标过小 | Android 文件与主机交互 | ✅ 已解决 | 50% 目录覆盖阈值、一体化面板、全宽可滑动抽屉与大尺寸文字操作带 | 2026-07-22 |
| P57 | 2026-07-22 | Android 抽屉只在松手后跳变且外层露底，目录刷新会销毁滚动容器并回顶 | Android 抽屉与全平台文件刷新 | ✅ 已解决 | 连续拖动进度、全覆盖抽屉、紧凑横向操作栏与保留 DOM 的无感刷新 | 2026-07-22 |
| P58 | 2026-07-23 | 当前目录拖放边框触发滚动/裁切且桌面文件落点失效，Android 抽屉手势、面板层级、主机表单与底部安全区不统一 | 全平台拖放与 Android UI | ✅ 已解决 | 无边框模糊覆盖层、文件行当前目录映射、全局单一抽屉手势、单层面板及 Android 专项表单/安全区 | 2026-07-23 |
| P59 | 2026-07-23 | Windows 路径栏仅能切换已连接主机，Android Portal 弹层无法阻止全局抽屉手势且触摸外部不收起 | Windows 连接入口与 Android 弹层交互 | ✅ 已解决 | 桌面全主机单操作下拉、空面板重连入口、共享安全连接流程及 Portal 活动遮罩门禁 | 2026-07-23 |
| P60 | 2026-07-23 | Android 主机下拉过宽、横向操作带误触抽屉，抽屉逐帧顶层渲染造成卡顿风险 | Android 菜单与抽屉性能 | ✅ 已解决 | 224px 移动菜单、滚动区手势排除、rAF 合并 CSS 变量更新及合成层位移 | 2026-07-23 |
| P61 | 2026-07-23 | Android 五档字号被平台 CSS 强制覆盖，通用 Select 主文字固定 10px 未接入字体等级 | 全局排版 | ✅ 已解决 | 原生目标区分平台默认值、移除移动字号覆盖、首帧预加载，Select 主/次文字绑定正文与提示令牌 | 2026-07-23 |
| P62 | 2026-07-23 | 主机菜单空白过多、Vault 30 秒轮询清空未保存凭据字段，云端完整设置跨平台互相覆盖 | 双平台 UI 与云同步 | ✅ 已解决 | 248/184px 菜单、编辑感知凭据草稿、共享主机 + Platform 设置分区的云端 schema v2 | 2026-07-23 |
| P63 | 2026-07-24 | Windows 主机菜单仍偏宽、开发 APK 离线启动缺少资源、Sync now 无变化也上传且跨平台 revision 误冲突 | Windows UI、Android 构建与云同步 | ✅ 已解决 | 196px + 纯图标操作、Release 资源/签名验证、平台作用域 SHA-256 三方比较 | 2026-07-24 |
| P64 | 2026-07-24 | Android 抽屉松手偶发跳变、Photo Picker URI 无法读取、文本菜单/Autofill 缺失且大面积玻璃模糊增加 GPU 负担 | Android 交互、存储与性能 | ✅ 已解决 | 独立 settle 动画、ContentResolver 私有导入、文本菜单放行与表单 Autofill 语义、移动端取消全屏 blur | 2026-07-24 |
| P65 | 2026-07-24 | Android 私有背景经 Base64 IPC 回传后未显示，云端平台配置内嵌背景导致主文件膨胀和重复上传 | Android 背景与 WebDAV 云同步 | ✅ 已解决 | Asset Protocol 受限读取、schema v3 内容寻址平台背景压缩包、配置 gzip 后加密及摘要增量上传 | 2026-07-24 |
| P66 | 2026-07-24 | 曾推测 Android 背景仅因 Asset Protocol scope 少一层 `files` 而失败 | Android 背景显示 | ⚪ 已替代 | scope 修正经真机反馈仍不生效；P67 移除该渲染依赖并改用二进制 Blob | 2026-07-24 |
| P67 | 2026-07-24 | Android 背景仍不显示且关闭闪白、周期同步不访问云端、在线编辑不能滚动、设置首次打开卡顿 | Android 渲染、跨平台同步与共享 UI | ✅ 已解决 | 二进制 Blob 背景、独立作用域三方合并、CodeMirror 滚动容器与空闲预加载 | 2026-07-24 |
| P68 | 2026-07-24 | 同扩展名 Android 背景路径不变、CodeMirror scroller 被裁切、轮询闪屏且整体主机哈希无法合并并发记录 | Android 背景、编辑器、Windows 刷新与云同步 | ✅ 已解决 | 内容寻址导入、可收缩 scroller、静默主机刷新及加密快照逐 UUID 三方合并 | 2026-07-24 |
| P69 | 2026-07-24 | CodeMirror 文本存在但视口高度为 0，Android 窄屏规则误隐藏 WebDAV 状态 | Android 编辑器与状态栏 | ✅ 已解决 | 稳定宿主类逐级高度约束、真实 scroller 滚动及原生平台状态显式恢复 | 2026-07-24 |
| P70 | 2026-07-25 | 编辑器关闭后全局状态残留，Android Vault 状态被底栏压缩且横屏进入不可用桌面布局 | 全平台编辑状态与 Android 顶栏 | ✅ 已解决 | 消息所有权清理、移动标题栏 Vault 胶囊、可调应用栏高度及 API 36 竖屏兼容策略 | 2026-07-25 |
| P71 | 2026-07-25 | Android 顶栏高度下限偏高，Vault 胶囊日期偏小且右侧空间利用不足 | Android 标题栏 | ✅ 已解决 | 32px 自适应下限、日期等宽放大与右侧语义同步状态灯 | 2026-07-25 |

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
| M3.1 — Android 真机运行 | Phase 3 | — | 2026-07-19 | ✅ | ARM64 Android 12+ 真机安装与运行已验证 |
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
| v1.42 | 2026-07-19 | 重构 Android 顶栏、空状态、主机抽屉、设置中心与主机弹窗排版 | AI |
| v1.43 | 2026-07-19 | 修复 Android Keystore 持久化并将云端恢复改为默认暂停同步 | AI |
| v1.44 | 2026-07-19 | 重构 Android 路径工具栏、长按拖拽、主机操作与底部状态栏 | AI |
| v1.45 | 2026-07-19 | 完成 Android 文件选择操作带、复选框三列表格与触摸拖动反馈 | AI |
| v1.46 | 2026-07-22 | 修复 Android 矩形拖放仲裁、当前目录反馈、圆角表面与传输状态裁切 | AI |
| v1.47 | 2026-07-22 | 完成 Android 目录覆盖阈值、一体化文件面板、全宽手势抽屉及共享表头轨道修复 | AI |
| v1.48 | 2026-07-22 | 完成 Android 实时抽屉、全覆盖主机层、紧凑操作栏及跨平台刷新滚动保持 | AI |
| v1.49 | 2026-07-23 | 完成无边框跨面板拖放反馈、Windows 文件落点修复及 Android 全局抽屉、单层面板、主机表单与安全区收敛 | AI |
| v1.50 | 2026-07-23 | 完成 Windows 路径栏全主机连接管理、空面板重连入口与 Android 弹层手势互斥 | AI |
| v1.51 | 2026-07-23 | 收紧 Android 主机下拉与操作带手势边界，优化抽屉逐帧渲染，并调整双平台主机凭据字段比例 | AI |
| v1.52 | 2026-07-23 | 修复 Android 五档字号覆盖与启动偏差，隔离双平台默认值，并让通用下拉遵循正文与提示字体等级 | AI |
| v1.53 | 2026-07-23 | 收紧双平台主机菜单，修复 Vault 轮询覆盖输入，并完成主机共享、其余设置按平台隔离的云端 schema v2 | AI |
| v1.54 | 2026-07-24 | 收紧 Windows 主机菜单为纯图标操作，确认 Android 离线 Release 资源，并实现 WebDAV 平台作用域指纹增量同步 | AI |
| v1.55 | 2026-07-24 | 修复 Android 抽屉收尾动画、Photo Picker 背景导入、文本选择/Autofill，并降低 WebView 全屏模糊合成成本 | AI |
| v1.56 | 2026-07-24 | 修复 Android 私有背景显示，并将 WebDAV 平台背景拆分为摘要索引和独立 gzip 增量资源 | AI |
| v1.57 | 2026-07-24 | 改用 Android 二进制 Blob 背景，完成 WebDAV 双向轮询、编辑器滚动与设置首开预热 | AI |
| v1.58 | 2026-07-24 | 修复 Android 背景热切换与编辑器真实滚动，恢复抽屉毛玻璃，完成静默轮询、逐主机三方合并及移动滑块方向锁 | AI |
| v1.59 | 2026-07-24 | 真机修复 Android 在线编辑器零高度视口，并恢复底部 WebDAV 当前同步状态 | AI |
| v1.60 | 2026-07-25 | 修复编辑状态残留，将 Android Vault 状态移入可调标题栏并加入可持久化竖屏构建策略 | AI |
| v1.61 | 2026-07-25 | 将 Android 顶栏下限降至 32px，并放大 Vault 日期、增加同步状态灯 | AI |
| v1.62 | 2026-07-25 | 让 Android 主机抽屉随工作区动态等尺寸，统一圆角间距并移除滑动渐变底色 | AI |
| v1.63 | 2026-07-25 | 修复 Android 主机抽屉关闭后在左侧间距短暂残留的问题 | AI |

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
