# PC Close Permission Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore reliable desktop exit while preserving the bounded Vault flush and explicit force-exit fallback.

**Architecture:** Use Tauri's awaited `onCloseRequested` lifecycle instead of recursively issuing a second close request. Grant the destroy permission required internally by that listener, prevent duplicate requests only while a flush is active, and call `destroy()` explicitly only for the user's force-exit decision.

**Tech Stack:** React 19, TypeScript 5.9, Tauri JavaScript window API, Tauri 2 capabilities, Bun/Vitest source-contract tests.

## Global Constraints

- Desktop close interception remains excluded when the native `mobile-platform` class is present.
- Keep `flush_vault_sync`, its 10-second backend timeout, durable pending state, generation protection, and next-start retry unchanged.
- Do not add protocol-specific branches or bypass `FileTransport`.
- Do not introduce frontend `any` or non-test Rust `unwrap()`/`expect()`.
- Use Bun for frontend commands.
- Complete the mandatory `bun lint && bun format && bun test` gate before the implementation commit.

---

### Task 1: Correct the Desktop Close Lifecycle and Capability

**Files:**

- Modify: `src/hooks/useVaultCloseGuard.test.ts`
- Modify: `src/components/layout/AppTitleBar.test.ts`
- Modify: `src/hooks/useVaultCloseGuard.ts`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**

- Consumes: `flushVaultSync(): Promise<VaultSyncStatus>` and Tauri `CloseRequestedEvent.preventDefault()`.
- Preserves: `useVaultCloseGuard(): { closeFailureVisible: boolean; cancelClose: () => void; forceClose: () => void }`.
- Requires: `core:window:allow-destroy` in the desktop capability.
- Produces: one awaited close handler with no recursive success-path `close()`.

- [x] **Step 1: Replace the old close contract with failing lifecycle assertions**

Update `src/hooks/useVaultCloseGuard.test.ts` so the tests require:

```ts
expect(hook).toContain('onCloseRequested(async (event) =>');
expect(hook).toContain('if (flushInProgressRef.current)');
expect(hook).toContain('await flushVaultSync()');
expect(hook).not.toContain('allowCloseRef');
expect(hook).not.toContain('await appWindow.close()');
expect(hook).toMatch(
  /try\s*\{[\s\S]*?await flushVaultSync\(\);[\s\S]*?\}\s*catch\s*\{[\s\S]*?event\.preventDefault\(\);/,
);
expect(hook).toMatch(/const forceClose[\s\S]*?appWindow\.destroy\(\)/);
```

Keep ordering assertions proving the `mobile-platform` return occurs before listener registration and the duplicate-request branch calls `event.preventDefault()` before returning. Extend `src/components/layout/AppTitleBar.test.ts` to require:

```ts
'core:window:allow-destroy',
```

- [x] **Step 2: Run the focused tests and verify the regression is red**

Run:

```powershell
bun test src/hooks/useVaultCloseGuard.test.ts src/components/layout/AppTitleBar.test.ts
```

Expected: FAIL because the handler is not async, still uses `allowCloseRef` plus recursive `close()`, and the capability lacks `allow-destroy`.

- [x] **Step 3: Grant the required Tauri permission**

Add adjacent to `allow-close` in `src-tauri/capabilities/default.json`:

```json
"core:window:allow-close",
"core:window:allow-destroy",
```

- [x] **Step 4: Implement the awaited close handler**

Remove `allowCloseRef`. Replace the listener with:

```ts
.onCloseRequested(async (event) => {
  if (flushInProgressRef.current) {
    event.preventDefault();
    return;
  }
  flushInProgressRef.current = true;
  try {
    await flushVaultSync();
  } catch {
    event.preventDefault();
    if (active) setCloseFailureVisible(true);
  } finally {
    flushInProgressRef.current = false;
  }
})
```

Successful completion must not prevent or recursively close; the installed Tauri wrapper destroys the window after the handler resolves. Replace `forceClose` with:

```ts
const forceClose = useCallback(() => {
  try {
    const appWindow = getCurrentWindow();
    setCloseFailureVisible(false);
    void appWindow.destroy().catch(() => setCloseFailureVisible(true));
  } catch {
    setCloseFailureVisible(true);
  }
}, []);
```

- [x] **Step 5: Run focused tests, lint, and formatting**

Run:

```powershell
bun test src/hooks/useVaultCloseGuard.test.ts src/components/layout/AppTitleBar.test.ts
bun lint
bun format
```

Expected: focused tests pass; ESLint and Prettier exit successfully.

- [x] **Step 6: Commit the lifecycle fix**

```powershell
git add -- src/hooks/useVaultCloseGuard.ts src/hooks/useVaultCloseGuard.test.ts src/components/layout/AppTitleBar.test.ts src-tauri/capabilities/default.json
git commit -m "fix: restore desktop window closing"
```

---

### Task 2: Full Regression, Documentation, and Delivery

**Files:**

- Modify: `docs/06-progress-log.md`
- Modify: `docs/superpowers/plans/2026-08-11-pc-close-permission-regression.md`

**Interfaces:**

- Consumes: corrected close guard and capability from Task 1.
- Produces: verified repository, Session #083 delivery record, and clean worktree.

- [x] **Step 1: Run mandatory frontend gates and production build**

```powershell
bun lint && bun format && bun test
bun run build
```

Expected: all frontend tests pass and Vite completes the production bundle.

- [x] **Step 2: Run Rust regression gates**

```powershell
cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --lib --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --lib --manifest-path src-tauri/Cargo.toml
bun run types:format
```

Expected: formatting, Clippy, and all Rust library tests pass; generated TypeScript is restored to formatted output.

- [x] **Step 3: Update progress documentation**

Add Session #083 to `docs/06-progress-log.md` with the confirmed permission root cause, awaited handler, duplicate-request protection, explicit force destroy, desktop-only isolation, exact test totals, build results, and remaining user-run package validation.

- [x] **Step 4: Review and commit documentation**

```powershell
git diff --check
git status --short
git log --oneline e742710..HEAD
git add -- docs/06-progress-log.md docs/superpowers/plans/2026-08-11-pc-close-permission-regression.md
git commit -m "docs: record desktop close regression repair"
```

- [x] **Step 5: Remove transient planning files and verify clean state**

Delete `task_plan.md`, `findings.md`, and `progress.md` through `apply_patch`, then run `git status --short` and expect no output.
