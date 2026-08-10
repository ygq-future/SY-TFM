# Vault Sync Host Settings Canonicalization Design

## Problem

The cloud vault stores hosts in a shared list and per-platform `downloadPath` overrides in
`hostSettings`. The sync classifier hashes serialized platform payloads. Semantically equivalent
representations—missing override versus `downloadPath: null`, an override for a deleted host, or a
different override order—therefore produce different hashes. After Android pulls a PC host change,
the next manual sync can incorrectly classify Android settings as locally changed and upload a new
revision.

## Design

Keep schema v3 and introduce one canonical representation for platform comparison:

- omit overrides whose `downloadPath` is `None`;
- omit overrides whose `hostId` is not present in the payload's shared hosts;
- sort remaining overrides by stable host UUID;
- use the canonical platform payload in both the combined scope hash and independent platform hash;
- construct new platform payloads in the same sparse, stable order.

Canonicalization is comparison-only for remote payloads. It does not rewrite the cloud file unless
another real change already requires upload, so upgrading an existing device cannot manufacture a
migration revision.

## Data Flow

1. Download and decrypt the remote cloud payload.
2. Build the local desired payload using sparse, UUID-sorted host overrides.
3. Canonicalize the current platform view before computing local, remote, and final hashes.
4. Perform the existing three-way host merge and platform change classification.
5. Upload only when the existing `push_hosts || push_platform` gate reports a semantic change.

## Compatibility and Safety

- No protocol branches or adapter changes.
- No schema, enum, generated TypeScript, credential, or encryption-format changes.
- Existing cloud payloads with redundant or stale rows remain readable.
- Windows, Android, macOS, Linux, and iOS use the same backend comparison rule.

## Tests

Focused Rust regression tests cover remote host addition, deletion with stale overrides, and reorder.
Each test restores the remote payload, rebuilds the current-platform payload, and asserts identical
platform hashes. Existing vault-sync tests and the full project quality gates must continue to pass.
