import { describe, expect, it } from 'vitest';
import type { VaultSyncPhase } from '../../types/enums/VaultSyncPhase';
import type { VaultSyncStatus } from '../../types/generated/VaultSyncStatus';
import { isVaultSyncing, vaultStatusLabelKey } from './vaultSyncStatusView';

function status(phase: VaultSyncPhase, enabled = true): VaultSyncStatus {
  return {
    configured: true,
    enabled,
    phase,
    vaultInitialized: true,
    passwordSaved: true,
    backupPasswordSaved: true,
    webdavUrl: 'https://cloud.example.com/dav',
    username: 'alice',
    remotePath: '/SY-TFM/sy-tfm-vault.sytfm',
    revision: 4n,
    lastSyncedAt: '2026-08-10T00:00:00Z',
    unlockedOnDevice: true,
    refreshIntervalMs: 30_000,
  };
}

describe('vault synchronization status view', () => {
  it('maps every enabled lifecycle phase to distinct copy', () => {
    expect(vaultStatusLabelKey(status('idle'))).toBe('settings.storage.vaultStatusActive');
    expect(vaultStatusLabelKey(status('pending'))).toBe('settings.storage.vaultStatusPending');
    expect(vaultStatusLabelKey(status('syncing'))).toBe('settings.storage.vaultStatusSyncing');
    expect(vaultStatusLabelKey(status('failed'))).toBe('settings.storage.vaultStatusFailed');
  });

  it('keeps paused state ahead of a stale runtime failure', () => {
    expect(vaultStatusLabelKey(status('failed', false))).toBe('settings.storage.vaultStatusPaused');
  });

  it('animates only the actual syncing phase', () => {
    expect(isVaultSyncing(status('syncing'))).toBe(true);
    expect(isVaultSyncing(status('pending'))).toBe(false);
    expect(isVaultSyncing(status('failed'))).toBe(false);
  });
});
