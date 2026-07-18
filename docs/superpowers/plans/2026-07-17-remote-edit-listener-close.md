# Remote Edit Listener 手动关闭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在活动 Remote Edit listener 菜单的每一项右侧增加无需确认的关闭按钮，调用现有 `stop_remote_edit` 接口停止监听并即时更新列表。

**Architecture:** 停止操作完全封装在 `RemoteEditSessionsMenu` 内，不增加 `App.tsx` 回调或全局状态。组件按 session ID 维护正在停止的集合；后端返回 `true` 或 `false` 都视为最终已停止并从快照中移除，调用抛错时保留条目、展示局部错误并允许重试。

**Tech Stack:** React 19、TypeScript、react-i18next、lucide-react、Tauri invoke、Vitest、CSS

---

## 文件结构

- Modify: `src/features/editor/EditorIntegration.test.ts` — 为停止 API 接线、独立按钮结构和样式约束增加回归测试。
- Modify: `src/features/editor/RemoteEditSessionsMenu.tsx` — 调用 `stopRemoteEdit`，维护单项 stopping 状态和局部错误，拆分“重新打开”和“停止监听”按钮。
- Modify: `src/index.css` — 为 listener 行容器、主体按钮、关闭按钮及停止态添加样式。
- Modify: `src/locales/zh.json` — 增加停止监听和失败文案。
- Modify: `src/locales/en.json` — 增加对应英文文案。

不修改 Rust manager、Tauri command、生成类型或 `App.tsx`；现有后端能力已足够。

### Task 1: 添加失败的前端集成测试

**Files:**
- Modify: `src/features/editor/EditorIntegration.test.ts:55-74`

- [ ] **Step 1: 扩展 listener 集成测试**

在现有 `reuses active remote edit watchers...` 测试末尾增加以下断言：

```ts
const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
expect(sessionMenu).toContain('stopRemoteEdit');
expect(sessionMenu).toContain('remote-edit-session-stop');
expect(sessionMenu).toContain("t('editor.stopSession'");
expect(sessionMenu).toContain("t('editor.stopSessionFailed'");
expect(styles).toContain('.remote-edit-session-stop');
```

这些断言固定本次最小契约：组件必须调用已有停止 API、提供独立关闭按钮、使用可访问的翻译文案，并具有对应样式。

- [ ] **Step 2: 运行目标测试并确认失败**

Run:

```bash
bunx vitest run src/features/editor/EditorIntegration.test.ts
```

Expected: listener 集成用例 FAIL，至少提示 `sessionMenu` 尚不包含 `stopRemoteEdit` 或 `remote-edit-session-stop`。

### Task 2: 实现 listener 单项停止交互

**Files:**
- Modify: `src/features/editor/RemoteEditSessionsMenu.tsx:1-108`
- Modify: `src/locales/zh.json:210-214`
- Modify: `src/locales/en.json:210-214`

- [ ] **Step 1: 增加 API、图标和状态**

将导入调整为：

```tsx
import { ExternalLink, FilePenLine, LoaderCircle, X } from 'lucide-react';
import { listRemoteEditSessions, stopRemoteEdit } from '../../lib/tauri';
```

在现有状态后增加：

```tsx
const [stoppingSessionIds, setStoppingSessionIds] = useState<Set<string>>(() => new Set());
```

继续复用现有 `errorMessage`，停止失败时显示局部错误；每次加载列表时仍由 `loadSessions()` 清空旧错误。

- [ ] **Step 2: 增加停止处理函数**

在 `loadSessions` 后加入：

```tsx
const handleStop = useCallback(
  async (session: RemoteEditSessionInfo) => {
    const sessionId = session.editSessionId;
    setStoppingSessionIds((current) => new Set(current).add(sessionId));
    setErrorMessage('');

    try {
      await stopRemoteEdit(sessionId);
      setSessions((current) =>
        current.filter((item) => item.editSessionId !== sessionId),
      );
    } catch (error) {
      setErrorMessage(
        t('editor.stopSessionFailed', {
          name: session.fileName,
          error: formatAppError(error),
        }),
      );
    } finally {
      setStoppingSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
    }
  },
  [t],
);
```

这里故意忽略 boolean 返回值：`true` 表示刚刚停止，`false` 表示该 ID 已不存在，两者都满足前端“列表中不应继续显示”的最终状态。

- [ ] **Step 3: 拆分菜单项的两个按钮**

将每条 listener 从单个 `<button>` 改为以下结构，避免嵌套按钮：

```tsx
<div className="remote-edit-session-item" key={session.editSessionId} role="none">
  <button
    className="remote-edit-session-open"
    type="button"
    role="menuitem"
    title={session.remotePath}
    onClick={() => {
      setIsOpen(false);
      void onOpen(session);
    }}
  >
    <FilePenLine />
    <span>
      <strong>{session.fileName}</strong>
      <small>{session.remotePath}</small>
    </span>
    <ExternalLink />
  </button>
  <button
    className="remote-edit-session-stop"
    type="button"
    title={t('editor.stopSession', { name: session.fileName })}
    aria-label={t('editor.stopSession', { name: session.fileName })}
    disabled={stoppingSessionIds.has(session.editSessionId)}
    onClick={() => void handleStop(session)}
  >
    {stoppingSessionIds.has(session.editSessionId) ? (
      <LoaderCircle className="is-spinning" />
    ) : (
      <X />
    )}
  </button>
</div>
```

点击关闭按钮不关闭菜单、不调用 `onOpen`、不显示确认框。停止期间仅禁用对应 listener 的关闭按钮。

- [ ] **Step 4: 保持列表可用并展示停止错误**

把现有三分支渲染逻辑调整为：加载失败仍可使用现有整块错误状态；有 sessions 时始终渲染列表，并在列表上方或下方额外渲染停止错误：

```tsx
{errorMessage && sessions.length > 0 && (
  <div className="remote-edit-menu-inline-error" role="alert">
    {errorMessage}
  </div>
)}
```

停止失败后条目保留，按钮在 `finally` 后恢复，用户可以重试。加载失败且列表为空时继续显示：

```tsx
{t('editor.sessionsFailed', { error: errorMessage })}
```

- [ ] **Step 5: 增加中英文文案**

在 `src/locales/zh.json` 的 `editor` 节点增加：

```json
"stopSession": "停止监听 {{name}}",
"stopSessionFailed": "无法停止监听 {{name}}：{{error}}"
```

在 `src/locales/en.json` 的 `editor` 节点增加：

```json
"stopSession": "Stop watching {{name}}",
"stopSessionFailed": "Could not stop watching {{name}}: {{error}}"
```

- [ ] **Step 6: 运行目标测试确认实现契约通过**

Run:

```bash
bunx vitest run src/features/editor/EditorIntegration.test.ts
```

Expected: PASS。

### Task 3: 调整 listener 菜单样式

**Files:**
- Modify: `src/index.css:4974-5037`

- [ ] **Step 1: 将列表项改为容器布局**

替换以 `.remote-edit-session-list > button` 为入口的现有样式，增加：

```css
.remote-edit-session-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  align-items: stretch;
  gap: 2px;
}

.remote-edit-session-open {
  display: grid;
  min-width: 0;
  grid-template-columns: 18px minmax(0, 1fr) 14px;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  border: 0;
  border-radius: 7px;
  background: transparent;
  padding: 7px;
  color: var(--app-ink);
  text-align: left;
  transition: 130ms ease;
}

.remote-edit-session-open:hover,
.remote-edit-session-open:focus-visible {
  background: color-mix(in srgb, var(--accent) 18%, var(--modal-control));
  color: var(--accent-strong);
}
```

把原来针对 `> button > svg`、`> button > span` 的规则改为 `.remote-edit-session-open > svg` 和 `.remote-edit-session-open > span`。

- [ ] **Step 2: 增加停止按钮和错误样式**

```css
.remote-edit-session-stop {
  display: grid;
  width: 28px;
  min-height: 28px;
  place-items: center;
  align-self: center;
  cursor: pointer;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-muted);
  transition: 130ms ease;
}

.remote-edit-session-stop:hover,
.remote-edit-session-stop:focus-visible {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}

.remote-edit-session-stop:disabled {
  cursor: default;
  opacity: 0.6;
}

.remote-edit-session-stop svg {
  width: 13px;
  height: 13px;
}

.remote-edit-menu-inline-error {
  padding: 5px 7px;
  color: var(--danger);
  font-size: var(--type-caption-size);
  line-height: 1.35;
}
```

- [ ] **Step 3: 运行格式检查和目标测试**

Run:

```bash
bunx prettier --check src/features/editor/RemoteEditSessionsMenu.tsx src/features/editor/EditorIntegration.test.ts src/index.css src/locales/zh.json src/locales/en.json
bunx vitest run src/features/editor/EditorIntegration.test.ts
```

Expected: 两条命令均成功；Prettier 报告所有指定文件符合格式，目标测试 PASS。

### Task 4: 完整前端验证

**Files:**
- Verify only

- [ ] **Step 1: 运行 ESLint**

Run:

```bash
bun run lint
```

Expected: exit code 0，无 ESLint error。

- [ ] **Step 2: 运行全部 Vitest 测试**

Run:

```bash
bun run test
```

Expected: exit code 0，全部测试通过。

- [ ] **Step 3: 运行生产构建**

Run:

```bash
bun run build
```

Expected: TypeScript 编译和 Vite build 成功，无类型错误。

- [ ] **Step 4: 检查最终差异范围**

Run:

```bash
git diff -- src/features/editor/RemoteEditSessionsMenu.tsx src/features/editor/EditorIntegration.test.ts src/index.css src/locales/zh.json src/locales/en.json
```

Expected: 仅包含停止 listener 所需的组件、测试、样式和翻译改动；不包含 Rust、生成类型或 `App.tsx` 改动。

本计划不自动提交，因为当前工作树已有大量由前一个 AI 留下的未提交改动，且用户没有要求提交。
