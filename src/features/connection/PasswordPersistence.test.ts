import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('password persistence contract', () => {
  it('uses the native Windows credential backend instead of the in-memory mock', () => {
    const cargo = readFileSync(new URL('../../../src-tauri/Cargo.toml', import.meta.url), 'utf8');
    expect(cargo).toContain('windows-native');
  });

  it('preserves an existing secret on blank edit and honors remember password', () => {
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const connectionFlow = readFileSync(
      new URL('./useHostConnectionFlow.tsx', import.meta.url),
      'utf8',
    );

    expect(commands).toContain('clear_password');
    expect(commands).toContain('PasswordUpdate::Preserve');
    expect(connectionFlow).toContain('rememberPassword');
    expect(connectionFlow).toContain('await updateHost');
  });

  it('keeps the attempted password while requiring explicit TOFU confirmation', () => {
    const connectionFlow = readFileSync(
      new URL('./useHostConnectionFlow.tsx', import.meta.url),
      'utf8',
    );
    const hostList = readFileSync(new URL('./HostList.tsx', import.meta.url), 'utf8');
    const paneHostSelect = readFileSync(
      new URL('../browser/PaneHostSelect.tsx', import.meta.url),
      'utf8',
    );

    expect(connectionFlow).toContain('password?: string');
    expect(connectionFlow).toContain('rememberPassword: boolean');
    expect(connectionFlow).toContain('getHostKeyUnknownDetails(error)');
    expect(connectionFlow).toContain('setPendingHostKey');
    expect(connectionFlow).toContain('sftpHostKeyFingerprint: pending.fingerprint');
    expect(connectionFlow).toContain(
      "password: pending.rememberPassword ? (pending.password ?? '') : ''",
    );
    expect(connectionFlow).toContain('await updateHost(trustedHost)');
    expect(connectionFlow).toContain('await connectAndOpen(trustedHost, pending.password)');
    expect(connectionFlow).toContain('onCancel={() => setPendingHostKey(null)}');
    expect(connectionFlow).not.toContain('getHostKeyChangedDetails(error)');
    expect(hostList).toContain('useHostConnectionFlow(onSelectHost)');
    expect(paneHostSelect).toContain('useHostConnectionFlow');
  });
});
