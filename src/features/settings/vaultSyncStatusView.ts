import type { VaultSyncStatus } from '../../types/generated/VaultSyncStatus';

export type VaultStatusLabelKey =
  | 'settings.storage.vaultStatusActive'
  | 'settings.storage.vaultStatusPending'
  | 'settings.storage.vaultStatusSyncing'
  | 'settings.storage.vaultStatusFailed'
  | 'settings.storage.vaultStatusPaused'
  | 'settings.storage.vaultStatusSaved';

/** 将后端同步阶段映射到两个状态表面共用的本地化文案。 */
export function vaultStatusLabelKey(status: VaultSyncStatus): VaultStatusLabelKey {
  if (!status.enabled) {
    return status.vaultInitialized
      ? 'settings.storage.vaultStatusPaused'
      : 'settings.storage.vaultStatusSaved';
  }
  switch (status.phase) {
    case 'pending':
      return 'settings.storage.vaultStatusPending';
    case 'syncing':
      return 'settings.storage.vaultStatusSyncing';
    case 'failed':
      return 'settings.storage.vaultStatusFailed';
    case 'idle':
      return 'settings.storage.vaultStatusActive';
  }
}

/** 仅真实网络协调阶段显示旋转反馈。 */
export function isVaultSyncing(status: VaultSyncStatus): boolean {
  return status.enabled && status.phase === 'syncing';
}
