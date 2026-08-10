# Vault Startup Sync Implementation Plan

> Approved behavior: perform one immediate, non-blocking Vault reconciliation after the initial local status resolves when synchronization is enabled.

## Task 1: Add the regression test

**Files:**

- Modify: `src/features/settings/VaultSync.test.ts`

Add a source-level lifecycle regression matching the existing Vault integration tests. It must require a `useRef(false)` one-shot gate, wait for non-null status, mark the startup state handled before dispatch, and invoke `reconcileVaultState()` only for an enabled Vault. Run the targeted test and confirm it fails before implementation.

## Task 2: Implement startup reconciliation

**Files:**

- Modify: `src/App.tsx`

Declare the startup gate near the existing application refs. Add an Effect after `reconcileVaultState` is defined and before periodic polling. On the first non-null Vault status, close the gate and dispatch the existing reconciliation only when enabled. Do not await it or alter error presentation.

Run the targeted Vault test and confirm it passes.

## Task 3: Verify and document

**Files:**

- Modify: `docs/06-progress-log.md`

Run `bun lint`, `bun format`, `bun test`, and `bun run build`. Record the root cause, behavior, platform scope, and exact validation results. Review the focused diff and repository status.

## Task 4: Commit

Stage only the implementation, regression test, design/plan, and progress-log update. Create a separate commit with message `fix: sync vault immediately on startup`, then verify the worktree is clean.
