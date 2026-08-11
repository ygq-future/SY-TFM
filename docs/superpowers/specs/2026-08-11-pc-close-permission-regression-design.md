# PC Close Permission Regression Repair Design

**Date:** 2026-08-11  
**Scope:** Windows/macOS/Linux desktop close lifecycle only

## Problem

Commit `d8785b3` registered `getCurrentWindow().onCloseRequested` so desktop exit could flush durable Vault changes. The installed Tauri API waits for this handler and, when the request is allowed, completes the close through `window.destroy()`. The desktop capability grants `core:window:allow-close` but not `core:window:allow-destroy`, so every allowed close is rejected by the capability system.

The hook also prevents the original request immediately and later issues a second `close()`. That recursive close is unnecessary and still ends at the same unauthorized `destroy()` call.

## Repair

1. Grant `core:window:allow-destroy` in the desktop `default` capability. This permission is required by Tauri's JavaScript close-request implementation once a listener is registered.
2. Register an asynchronous close-request handler and await `flushVaultSync()` inside it.
3. On flush success, return without calling `preventDefault()`; Tauri then completes the original request through its built-in destroy path.
4. On flush failure or timeout, call `event.preventDefault()` before the handler resolves and show the existing localized force-exit confirmation.
5. Force exit calls `appWindow.destroy()` directly and reports a failed destroy attempt by keeping the confirmation visible.

Repeated close requests remain serialized with the existing in-progress ref: while one flush is active, every additional close request calls `preventDefault()` and returns instead of bypassing the active flush. Android and iOS continue to return before listener registration based on the native `mobile-platform` marker. The backend 10-second timeout, durable pending flag, generation checks, and next-start retry behavior do not change.

## Alternatives Rejected

- **Add only the permission:** This would restore exit, but retain recursive close re-entry and a test suite coupled to the incorrect lifecycle assumption.
- **Move close coordination into Rust:** This adds another window-lifecycle path and frontend signaling protocol without improving the small, supported Tauri handler flow.

## Verification

- Replace the source-only close contract with assertions requiring an async handler, awaited flush, failure-or-duplicate-only `preventDefault()`, no success-path `close()`, and explicit force `destroy()`.
- Extend the titlebar capability test to require `core:window:allow-destroy`.
- Run the focused close/titlebar tests, then `bun lint && bun format && bun test`, `bun run build`, Rust formatting, Clippy, and library tests.
- Update `docs/06-progress-log.md`, commit the implementation, and leave Android/Windows package builds to the user.
