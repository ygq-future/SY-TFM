import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop vault close guard', () => {
  const hook = readFileSync(new URL('./useVaultCloseGuard.ts', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../lib/tauri.ts', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

  it('awaits the desktop flush and prevents only duplicate or failed close requests', () => {
    const mobileGuard = hook.indexOf("classList.contains('mobile-platform')");
    const listener = hook.indexOf('onCloseRequested(async (event) =>');
    const duplicateGuard = hook.indexOf('if (flushInProgressRef.current)', listener);
    const duplicateReturn = hook.indexOf('return;', duplicateGuard);
    const flush = hook.indexOf('await flushVaultSync()', duplicateReturn);
    expect(mobileGuard).toBeGreaterThan(-1);
    expect(listener).toBeGreaterThan(mobileGuard);
    expect(duplicateGuard).toBeGreaterThan(listener);
    expect(duplicateReturn).toBeGreaterThan(duplicateGuard);
    expect(hook.slice(duplicateGuard, duplicateReturn)).toContain('event.preventDefault()');
    expect(flush).toBeGreaterThan(duplicateReturn);
    expect(api).toContain("invoke<VaultSyncStatus>('flush_vault_sync')");
  });

  it('lets Tauri finish success and uses destroy only after explicit force exit', () => {
    expect(hook).not.toContain('allowCloseRef');
    expect(hook).toMatch(
      /try\s*\{[\s\S]*?await flushVaultSync\(\);[\s\S]*?\}\s*catch\s*\{[\s\S]*?event\.preventDefault\(\);/,
    );
    expect(hook).not.toContain('await appWindow.close()');
    expect(hook).toContain('setCloseFailureVisible(true)');
    expect(hook).toMatch(/const forceClose[\s\S]*?appWindow\.destroy\(\)/);
    expect(app).toContain('useVaultCloseGuard()');
    expect(app).toContain('closeFailureVisible &&');
    expect(app).toContain("t('settings.storage.vaultCloseForceMessage')");
  });
});
