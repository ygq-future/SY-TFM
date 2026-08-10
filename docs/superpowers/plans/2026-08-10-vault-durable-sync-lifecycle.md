# Vault Durable Sync Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shared-host Vault changes durable across exit, observable in real time, generation-safe during concurrent mutation, and protected from interrupted canonical WebDAV uploads.

**Architecture:** Persist a pending bit and monotonic host-change generation in `VaultSyncSettings`, while keeping the transient phase in the Vault core. A cancellation-safe debounce scheduler emits full status snapshots through `vault:status`; synchronization finalization reloads the latest settings and clears pending only for the captured generation. Desktop close delegates to a bounded backend flush, and Vault documents upload to a remote temporary path before `FileTransport::move_file` replaces the canonical file.

**Tech Stack:** Rust, Tokio, Tauri 2 commands/events/window lifecycle, `ts-rs`, React 19, Zustand, Vitest, WebDAV through the existing `FileTransport` trait.

## Global Constraints

- All protocol I/O remains behind `FileTransport`; no WebDAV branch may appear in Commands or React.
- New stable states are Rust enums in `src-tauri/src/enums/` and must be exported with `cargo test --test export_types`.
- Generated files under `src/types/enums/` and `src/types/generated/` are never edited manually.
- `VaultSyncSettings` additions use `serde(default)` and keep `configVersion` v3 and the current encryption format.
- No non-test Rust `unwrap()` or `expect()` and no frontend `any`.
- Desktop close behavior is guarded by the native `mobile-platform` signal; mobile lifecycle behavior must not change.
- The mandatory final gate is `bun lint && bun format && bun test`, followed by `bun run build`, Rust formatting, Clippy, and tests.

---

### Task 1: Durable Vault State Model

**Files:**

- Create: `src-tauri/src/enums/vault_sync_phase.rs`
- Modify: `src-tauri/src/enums/mod.rs`
- Modify: `src-tauri/src/enums/app_event.rs`
- Modify: `src-tauri/src/enums/vault_policy.rs`
- Modify: `src-tauri/src/models/vault_sync.rs`
- Modify: `src-tauri/src/core/vault_sync.rs`
- Modify: `src-tauri/tests/export_types.rs`
- Generate: `src/types/enums/VaultSyncPhase.ts`
- Generate: `src/types/generated/VaultSyncSettings.ts`
- Generate: `src/types/generated/VaultSyncStatus.ts`

**Interfaces:**

- Produces: `VaultSyncPhase::{Idle, Pending, Syncing, Failed}` serialized as lowercase.
- Produces: `VaultSyncSettings.sync_pending: bool` and `sync_change_generation: u64`.
- Produces: `VaultSyncStatus.phase: VaultSyncPhase`.
- Produces: `mark_host_sync_pending(settings: &mut AppSettings)`.
- Produces: `VaultPolicy::CloseFlushTimeoutMilliseconds = 10_000` and `AppEvent::VaultStatus = "vault:status"`.

- [x] **Step 1: Add failing Rust tests for pending generation and phase resolution**

Add tests in `vault_sync.rs` that require the following behavior:

```rust
#[test]
fn host_mutation_marks_enabled_vault_pending_and_advances_generation() {
    let mut settings = AppSettings::default();
    settings.vault_sync.enabled = true;
    mark_host_sync_pending(&mut settings);
    assert!(settings.vault_sync.sync_pending);
    assert_eq!(settings.vault_sync.sync_change_generation, 1);
}

#[test]
fn idle_runtime_phase_exposes_durable_pending_after_restart() {
    assert_eq!(resolved_sync_phase(VaultSyncPhase::Idle, true), VaultSyncPhase::Pending);
    assert_eq!(resolved_sync_phase(VaultSyncPhase::Idle, false), VaultSyncPhase::Idle);
}
```

- [x] **Step 2: Run the targeted tests and confirm they fail**

Run: `cargo test --lib vault_sync --manifest-path src-tauri/Cargo.toml`

Expected: FAIL because the enum, fields, and helpers do not exist.

- [x] **Step 3: Implement the enum, backward-compatible fields, event, policy, and pure helpers**

Use this enum shape:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/enums/")]
#[serde(rename_all = "lowercase")]
pub enum VaultSyncPhase { Idle, Pending, Syncing, Failed }
```

Add both settings fields with `#[serde(default)]`. Resolve `Idle + sync_pending` as `Pending`; non-idle runtime phases take precedence. `mark_host_sync_pending` must do nothing when Vault is disabled and use `saturating_add(1)` when enabled.

- [x] **Step 4: Export types and run model tests**

Run: `bun run types:export`

Run: `cargo test --lib vault_sync --manifest-path src-tauri/Cargo.toml`

Expected: generated TS contains the new phase and fields; Vault unit tests pass.

- [x] **Step 5: Commit the state model**

```powershell
git add -- src-tauri/src/enums src-tauri/src/models/vault_sync.rs src-tauri/src/core/vault_sync.rs src-tauri/tests/export_types.rs src/types/enums/VaultSyncPhase.ts src/types/generated/VaultSyncSettings.ts src/types/generated/VaultSyncStatus.ts
git commit -m "feat: persist vault synchronization state"
```

---

### Task 2: Cancellation-Safe Scheduler, Events, and Generation-Safe Finalization

**Files:**

- Modify: `src-tauri/src/core/vault_sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**

- Consumes: `VaultSyncPhase`, `AppEvent::VaultStatus`, `sync_pending`, and `sync_change_generation` from Task 1.
- Produces: `schedule_auto_sync(app: tauri::AppHandle)` that only aborts debounce timers.
- Produces: `sync_now_and_emit(app: &tauri::AppHandle, backup_password: Option<String>)`.
- Produces: `flush_pending_sync(app: &tauri::AppHandle) -> Result<VaultSyncStatus, AppError>`.
- Produces Tauri command: `flush_vault_sync`.

- [x] **Step 1: Add failing tests for generation-aware checkpoint application**

Extract a pure finalization helper and test both branches:

```rust
#[test]
fn matching_generation_clears_pending_after_success() {
    let mut latest = enabled_pending_settings(4);
    finalize_pending_generation(&mut latest, 4);
    assert!(!latest.vault_sync.sync_pending);
}

#[test]
fn newer_generation_survives_older_sync_completion() {
    let mut latest = enabled_pending_settings(5);
    finalize_pending_generation(&mut latest, 4);
    assert!(latest.vault_sync.sync_pending);
    assert_eq!(latest.vault_sync.sync_change_generation, 5);
}
```

Add source contract assertions to `src/features/settings/VaultSync.test.ts` requiring host save/reorder/delete/import to call `mark_host_sync_pending` before `SettingsService::save`, and requiring the scheduled task to remove its own timer slot before invoking network sync.

- [x] **Step 2: Run Rust and frontend targeted tests and confirm failure**

Run: `cargo test --lib generation --manifest-path src-tauri/Cargo.toml`

Run: `bun test src/features/settings/VaultSync.test.ts`

Expected: FAIL on missing generation finalization and event-aware scheduler.

- [x] **Step 3: Replace the abortable whole-sync task with a debounce-only task slot**

Store `{ id: u64, handle }` in `PENDING_AUTO_SYNC`. On reschedule, abort only the handle still in the slot. After sleep, the task calls `take_debounce_task(id)` before network I/O; if a newer slot exists it must remain untouched. A host change during network sync therefore schedules another task instead of aborting the active request.

Immediately after a host command saves pending state, call `schedule_auto_sync(app)`; the scheduler emits the current Pending status before sleeping. Convert `save_host`, `reorder_hosts`, `delete_host`, and `import_hosts` to accept `AppHandle`, and skip save/schedule for unchanged order, nonexistent deletion, or empty import.

- [x] **Step 4: Wrap synchronization with phase transitions and status events**

Refactor the existing body into a locked internal operation. The wrapper must follow this shape:

```rust
set_runtime_phase(VaultSyncPhase::Syncing)?;
emit_current_status(app);
match sync_now_locked(backup_password).await {
    Ok(_) => {
        set_runtime_phase(VaultSyncPhase::Idle)?;
        let latest = status()?;
        emit_status(app, &latest);
        Ok(latest)
    }
    Err(error) => {
        set_runtime_phase(VaultSyncPhase::Failed)?;
        emit_current_status(app);
        Err(error)
    }
}
```

Event emission is best effort and must never replace the synchronization result.

- [x] **Step 5: Make both checkpoint paths generation-safe**

Capture `sync.sync_change_generation` at synchronization start. `save_sync_checkpoint` and `apply_remote_scope` must reload the latest settings, update the cloud baseline, and call `finalize_pending_generation`. If generation changed while the request was active, preserve `latest.hosts` rather than the stale merged hosts and retain pending for the next task.

- [x] **Step 6: Add bounded close flush command**

`flush_pending_sync` cancels only a pending debounce timer, waits behind the synchronization lock, returns immediately if the latest settings are disabled or not pending, and otherwise synchronizes until pending is false. Wrap it in `tokio::time::timeout(Duration::from_millis(VaultPolicy::CloseFlushTimeoutMilliseconds.value() as u64), ...)`; on timeout set the runtime phase to Failed, emit the latest status, and map it to `ErrorCode::OperationTimeout`. Register `flush_vault_sync` in `lib.rs`.

- [x] **Step 7: Run focused tests and commit**

Run: `cargo test --lib vault_sync --manifest-path src-tauri/Cargo.toml`

Run: `bun test src/features/settings/VaultSync.test.ts`

Expected: all focused tests pass.

```powershell
git add -- src-tauri/src/core/vault_sync.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src/features/settings/VaultSync.test.ts
git commit -m "fix: make vault auto sync durable"
```

---

### Task 3: Atomic Vault Document Replacement

**Files:**

- Modify: `src-tauri/src/core/vault_sync.rs`

**Interfaces:**

- Consumes: `FileTransport::{upload_file, move_file, delete_file}`.
- Produces: `remote_upload_temp_path() -> String` using a UUID in the fixed Vault directory.
- Changes: `upload_document` uploads only to the temporary path, then moves to `cloud_file_path()`.

- [x] **Step 1: Add a recording test transport and failing upload tests**

Inside the Vault test module, implement a minimal `RecordingTransport` for all `FileTransport` methods. Record upload/move/delete paths and allow injected upload or move errors. Add asynchronous tests requiring:

```rust
assert!(operations[0].starts_with("upload:/SY-TFM/"));
assert_ne!(operations[0], "upload:/SY-TFM/sy-tfm-vault.sytfm");
assert_eq!(operations[1], "move:/SY-TFM/<temp>->/SY-TFM/sy-tfm-vault.sytfm");
```

Also require a move failure to call `delete_file(temp)` and return the original move error; upload failure must never call MOVE.

- [x] **Step 2: Run atomic upload tests and confirm failure**

Run: `cargo test --lib upload_document --manifest-path src-tauri/Cargo.toml`

Expected: FAIL because upload still targets the canonical path.

- [x] **Step 3: Implement temporary upload plus MOVE**

Generate a path such as `/SY-TFM/.vault-upload-<uuid>.sytfm`. Upload the complete encrypted local temp file there, call `adapter.move_file(&remote_temp, &cloud_file_path()).await`, and on MOVE error call `adapter.delete_file(&remote_temp).await` best-effort before returning the MOVE error. On upload error, best-effort delete the remote temp because some servers may have accepted a partial body.

- [x] **Step 4: Run Vault tests and commit**

Run: `cargo test --lib vault_sync --manifest-path src-tauri/Cargo.toml`

Expected: all Vault tests pass.

```powershell
git add -- src-tauri/src/core/vault_sync.rs
git commit -m "fix: replace cloud vault documents atomically"
```

---

### Task 4: Live Frontend Vault Status

**Files:**

- Create: `src/features/settings/vaultSyncStatusView.ts`
- Create: `src/features/settings/vaultSyncStatusView.test.ts`
- Modify: `src/lib/tauri.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppTitleBar.tsx`
- Modify: `src/components/layout/AppTitleBar.test.ts`
- Modify: `src/features/settings/VaultSync.test.ts`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: generated `VaultSyncPhase` and `VaultSyncStatus.phase`.
- Produces: `onVaultSyncStatus(callback) -> Promise<UnlistenFn>`.
- Produces: `vaultStatusLabelKey(status: VaultSyncStatus): VaultStatusLabelKey` and `isVaultSyncing(status)`.
- Produces: phase-aware bottom status and Android titlebar display.

- [x] **Step 1: Write failing view-model and wiring tests**

Test the exact key mapping:

```ts
expect(vaultStatusLabelKey(status('idle'))).toBe('settings.storage.vaultStatusActive');
expect(vaultStatusLabelKey(status('pending'))).toBe('settings.storage.vaultStatusPending');
expect(vaultStatusLabelKey(status('syncing'))).toBe('settings.storage.vaultStatusSyncing');
expect(vaultStatusLabelKey(status('failed'))).toBe('settings.storage.vaultStatusFailed');
```

Extend integration tests to require `listen<VaultSyncStatus>('vault:status'`, application-shell registration, Store update, idle-phase settings/host refresh, and a spinning icon only for `syncing`.

- [x] **Step 2: Run targeted tests and confirm failure**

Run: `bun test src/features/settings/vaultSyncStatusView.test.ts src/features/settings/VaultSync.test.ts src/components/layout/AppTitleBar.test.ts`

Expected: FAIL because phase view logic and listener are absent.

- [x] **Step 3: Implement the listener and phase view model**

Add `onVaultSyncStatus` alongside existing Tauri event wrappers. In `AppInner`, register once; set every event payload into `useVaultSyncStore`, and when a Syncing-to-Idle transition succeeds, hydrate settings and refresh hosts so remote merges appear immediately.

Use `vaultStatusLabelKey` in both status surfaces. Keep paused/saved precedence when `enabled=false`. Rename Chinese `vaultStatusActive` to “保险库已启用” and add localized Pending/Syncing/Failed copy. Failed copy must state that local changes remain pending.

- [x] **Step 4: Implement the visual activity indication**

Render `RefreshCw` with the existing `is-spinning` class only while phase is Syncing; otherwise render `Cloud`. Add phase modifier classes for pending and failed colors without changing desktop/mobile layout dimensions.

- [x] **Step 5: Run focused frontend tests and commit**

Run: `bun test src/features/settings/vaultSyncStatusView.test.ts src/features/settings/VaultSync.test.ts src/components/layout/AppTitleBar.test.ts`

Expected: all focused tests pass.

```powershell
git add -- src/features/settings/vaultSyncStatusView.ts src/features/settings/vaultSyncStatusView.test.ts src/lib/tauri.ts src/App.tsx src/components/layout/AppTitleBar.tsx src/components/layout/AppTitleBar.test.ts src/features/settings/VaultSync.test.ts src/locales/en.json src/locales/zh.json src/index.css
git commit -m "feat: show live vault synchronization state"
```

---

### Task 5: Desktop Close Flush and Force-Exit Choice

**Files:**

- Create: `src/hooks/useVaultCloseGuard.ts`
- Create: `src/hooks/useVaultCloseGuard.test.ts`
- Modify: `src/lib/tauri.ts`
- Modify: `src/App.tsx`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`

**Interfaces:**

- Consumes: backend `flush_vault_sync` command.
- Produces: `flushVaultSync(): Promise<VaultSyncStatus>`.
- Produces: `useVaultCloseGuard(): { closeFailureVisible: boolean; cancelClose: () => void; forceClose: () => void }`.

- [x] **Step 1: Add failing desktop close contract tests**

Require the hook source to:

- return before registering when the native `mobile-platform` class is present;
- synchronously call `event.preventDefault()` on the first desktop close;
- invoke `flushVaultSync()` for every first close, even if the frontend Store looks idle;
- set an allow-close ref and call `appWindow.close()` after success;
- expose the failure prompt after backend error/timeout;
- close without another flush only after explicit force confirmation.

- [x] **Step 2: Run the targeted test and confirm failure**

Run: `bun test src/hooks/useVaultCloseGuard.test.ts`

Expected: FAIL because the hook and flush wrapper are absent.

- [x] **Step 3: Implement the hook and command wrapper**

Register `getCurrentWindow().onCloseRequested`. Guard repeated close requests with refs, prevent the first close before awaiting, and clean up the native listener on unmount. Browser preview failures remain silent. `forceClose` sets the allow flag before calling close; `cancelClose` keeps the app open and clears the prompt.

- [x] **Step 4: Render the localized force-exit confirmation**

Call the hook from `AppInner` and render the existing `ConfirmDialog` only when `closeFailureVisible` is true. Use a danger confirm button with copy explaining that the durable pending flag will retry on next startup.

- [x] **Step 5: Run focused frontend tests and commit**

Run: `bun test src/hooks/useVaultCloseGuard.test.ts src/AppInteraction.test.ts`

Expected: all focused tests pass and mobile source assertions confirm platform isolation.

```powershell
git add -- src/hooks/useVaultCloseGuard.ts src/hooks/useVaultCloseGuard.test.ts src/lib/tauri.ts src/App.tsx src/locales/en.json src/locales/zh.json
git commit -m "fix: flush vault changes before desktop exit"
```

---

### Task 6: Full Regression, Documentation, and Delivery

**Files:**

- Modify: `docs/06-progress-log.md`
- Modify: `docs/superpowers/plans/2026-08-10-vault-durable-sync-lifecycle.md`

**Interfaces:**

- Consumes all previous tasks.
- Produces a fully verified repository and session log.

- [x] **Step 1: Run generated-type and Rust gates**

Run: `bun run types:export`

Run: `cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check`

Run: `cargo clippy --lib --manifest-path src-tauri/Cargo.toml -- -D warnings`

Run: `cargo test --lib --manifest-path src-tauri/Cargo.toml`

Expected: all commands pass with no generated diff left unformatted.

- [x] **Step 2: Run mandatory frontend gates and production build**

Run: `bun lint && bun format && bun test`

Run: `bun run build`

Expected: all checks and the Vite production build pass.

- [x] **Step 3: Update progress documentation**

Add a new topmost session entry describing the verified root cause, durable fields, scheduler safety, phase events, close behavior, atomic upload, platform isolation, exact test counts, and the remaining Android/Windows manual package validation.

- [x] **Step 4: Review the complete range and commit documentation**

Run: `git diff --check`

Run: `git status --short`

Run: `git log --oneline 88a0419..HEAD`

Expected: only intentional documentation/plan updates remain.

```powershell
git add -- docs/06-progress-log.md docs/superpowers/plans/2026-08-10-vault-durable-sync-lifecycle.md
git commit -m "docs: record durable vault sync delivery"
```

- [x] **Step 5: Verify final repository state**

Run: `git status --short`

Expected: clean worktree after removing transient `task_plan.md`, `findings.md`, and `progress.md` with `apply_patch`.
