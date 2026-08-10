# Vault Sync Host Settings Canonicalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent semantic no-op host pulls from uploading a new vault revision.

**Architecture:** Canonicalize per-platform host overrides at the payload construction and hashing boundaries while retaining the existing three-way merge and revision gate. The cloud schema and transport abstraction remain unchanged.

**Tech Stack:** Rust, serde, SHA-256, Tauri 2, existing `cargo test` and bun quality gates.

## Global Constraints

- Preserve the `FileTransport` adapter boundary and protocol-independent upper layers.
- Do not change schema versions, encryption formats, enums, or generated TypeScript types.
- Do not use `unwrap()` or `expect()` in non-test Rust code.
- Run `bun lint && bun format && bun test` before commit.

---

### Task 1: Canonical platform host overrides

**Files:**
- Modify: `src-tauri/src/core/vault_sync.rs`
- Modify: `docs/06-progress-log.md`

**Interfaces:**
- Consumes: `CloudVaultPayload`, `CloudPlatformPayload`, and `CloudPlatformHostSettings`.
- Produces: `canonical_platform_payload(payload: &CloudVaultPayload, platform: Platform) -> Option<CloudPlatformPayload>` used by both scope hashes.

- [x] **Step 1: Write failing regression tests**

Add tests that build a remote Android payload for shared-host addition, deletion with a stale
override, and host reorder; restore and rebuild each payload; then assert
`cloud_platform_hash(&rebuilt, Platform::Android) == cloud_platform_hash(&remote, Platform::Android)`.

- [x] **Step 2: Run the focused tests and verify failure**

Run: `cargo test --lib core::vault_sync::tests::platform_host_settings -- --nocapture`

Expected: at least one assertion fails because raw `host_settings` arrays differ.

- [x] **Step 3: Implement canonicalization**

Add a helper that clones the selected platform payload, retains only overrides with a non-null path
and a host ID present in `payload.hosts`, then sorts by `host_id`. Change `cloud_scope_hash` and
`cloud_platform_hash` to serialize this canonical value. Change local payload construction to omit
null overrides and sort by UUID.

- [x] **Step 4: Run focused and complete Rust validation**

Run:

```text
cargo test --lib core::vault_sync::tests -- --nocapture
cargo fmt --all -- --check
cargo clippy --lib -- -D warnings
cargo test --lib
```

Expected: all commands pass.

- [x] **Step 5: Update the project progress log and run frontend gates**

Append a session entry describing the root cause, canonicalization behavior, platform impact, and
test results. Run `bun lint && bun format && bun test`; all commands must pass.

- [x] **Step 6: Commit**

Stage only the implementation, tests, design/plan, and progress-log files. Commit with:

```text
fix: keep vault sync revisions idempotent
```
