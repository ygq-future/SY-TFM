import { create } from 'zustand';
import { getVaultSyncStatus } from '../lib/tauri';
import type { VaultSyncStatus } from '../types/generated/VaultSyncStatus';

interface VaultSyncState {
  status: VaultSyncStatus | null;
  setStatus: (status: VaultSyncStatus) => void;
  refreshStatus: () => Promise<void>;
}

/** 全局保险库同步状态，供设置页与底部状态栏共享。 */
export const useVaultSyncStore = create<VaultSyncState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
  refreshStatus: async () => {
    try {
      set({ status: await getVaultSyncStatus() });
    } catch {
      // 浏览器预览或后端尚未启动时保留当前状态。
    }
  },
}));
