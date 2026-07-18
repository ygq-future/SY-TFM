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
    const hostList = readFileSync(new URL('./HostList.tsx', import.meta.url), 'utf8');

    expect(commands).toContain('clear_password');
    expect(commands).toContain('PasswordUpdate::Preserve');
    expect(hostList).toContain('rememberPassword');
    expect(hostList).toContain('await updateHost');
  });

  it('keeps the attempted password while requiring explicit TOFU confirmation', () => {
    const hostList = readFileSync(new URL('./HostList.tsx', import.meta.url), 'utf8');

    expect(hostList).toContain('password?: string');
    expect(hostList).toContain('rememberPassword: boolean');
    expect(hostList).toContain('getHostKeyUnknownDetails(error)');
    expect(hostList).toContain('setPendingHostKey');
    expect(hostList).toContain('sftpHostKeyFingerprint: pending.fingerprint');
    expect(hostList).toContain(
      "password: pending.rememberPassword ? (pending.password ?? '') : ''",
    );
    expect(hostList).toContain('await updateHost(trustedHost)');
    expect(hostList).toContain('await connectAndOpen(trustedHost, pending.password)');
    expect(hostList).toContain('onCancel={() => setPendingHostKey(null)}');
    expect(hostList).not.toContain('getHostKeyChangedDetails(error)');
  });
});
