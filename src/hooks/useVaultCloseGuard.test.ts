import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop vault close guard', () => {
  const hook = readFileSync(new URL('./useVaultCloseGuard.ts', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../lib/tauri.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

  it('flushes every first desktop close and never installs on native mobile', () => {
    const mobileGuard = hook.indexOf("classList.contains('mobile-platform')");
    const listener = hook.indexOf('onCloseRequested');
    const prevent = hook.indexOf('event.preventDefault()');
    const flush = hook.indexOf('flushVaultSync()');
    expect(mobileGuard).toBeGreaterThan(-1);
    expect(listener).toBeGreaterThan(mobileGuard);
    expect(prevent).toBeGreaterThan(listener);
    expect(flush).toBeGreaterThan(prevent);
    expect(api).toContain("invoke<VaultSyncStatus>('flush_vault_sync')");
  });

  it('closes after success and exposes an explicit force-exit decision after failure', () => {
    expect(hook).toContain('const allowCloseRef = useRef(false);');
    expect(hook).toMatch(
      /flushVaultSync\(\)[\s\S]*?allowCloseRef\.current = true;[\s\S]*?appWindow\.close\(\)/,
    );
    expect(hook).toMatch(
      /await appWindow\.close\(\);[\s\S]*?\.catch\(\(\) => \{[\s\S]*?allowCloseRef\.current = false;/,
    );
    expect(hook).toContain('setCloseFailureVisible(true)');
    expect(hook).toMatch(
      /const forceClose[\s\S]*?allowCloseRef\.current = true;[\s\S]*?appWindow\.close\(\)/,
    );
    expect(app).toContain('useVaultCloseGuard()');
    expect(app).toContain('closeFailureVisible &&');
    expect(app).toContain("t('settings.storage.vaultCloseForceMessage')");
  });
});
