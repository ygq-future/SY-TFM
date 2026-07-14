import { create } from 'zustand';
import type { AdapterCapability } from '../types/enums/AdapterCapability';
import type { ConnectionStatus } from '../types/enums/ConnectionStatus';
import type { RemoteHost } from '../types/generated/RemoteHost';
import * as tauri from '../lib/tauri';

/** 连接管理状态。 */
interface ConnectionState {
  /** 主机列表 */
  hosts: RemoteHost[];
  /** 已连接的主机 ID 集合 */
  connectedHostIds: string[];
  /** 当前选中的主机 ID */
  selectedHostId: string | null;
  /** 各主机连接状态 */
  connectionStatus: Record<string, ConnectionStatus>;
  /** 各主机 adapter 能力 */
  hostCapabilities: Record<string, AdapterCapability>;
  /** 加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;

  // 动作
  loadHosts: () => Promise<void>;
  selectHost: (id: string | null) => void;
  connectHost: (id: string, password?: string) => Promise<void>;
  disconnectHost: (id: string) => Promise<void>;
  addHost: (host: RemoteHost) => Promise<void>;
  updateHost: (host: RemoteHost) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;
  setConnectionStatus: (hostId: string, status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  hosts: [],
  connectedHostIds: [],
  selectedHostId: null,
  connectionStatus: {},
  hostCapabilities: {},
  isLoading: false,
  error: null,

  loadHosts: async () => {
    set({ isLoading: true, error: null });
    try {
      const hosts = await tauri.getHosts();
      set({ hosts, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  selectHost: (id) => set({ selectedHostId: id }),

  connectHost: async (id, password) => {
    set({ error: null });
    try {
      const result = await tauri.connectHost(id, password);
      set((state) => ({
        connectedHostIds: state.connectedHostIds.includes(id)
          ? state.connectedHostIds
          : [...state.connectedHostIds, id],
        connectionStatus: { ...state.connectionStatus, [id]: 'connected' as ConnectionStatus },
        hostCapabilities: { ...state.hostCapabilities, [id]: result.capabilities },
      }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  disconnectHost: async (id) => {
    try {
      await tauri.disconnectHost(id);
      set((state) => ({
        connectedHostIds: state.connectedHostIds.filter((h) => h !== id),
        selectedHostId: state.selectedHostId === id ? null : state.selectedHostId,
      }));
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  addHost: async (host) => {
    await tauri.saveHost(host);
    set((state) => ({ hosts: [...state.hosts, host] }));
  },

  updateHost: async (host) => {
    await tauri.saveHost(host);
    set((state) => ({
      hosts: state.hosts.map((h) => (h.id === host.id ? host : h)),
    }));
  },

  deleteHost: async (id) => {
    await tauri.deleteHost(id);
    set((state) => ({
      hosts: state.hosts.filter((h) => h.id !== id),
      connectedHostIds: state.connectedHostIds.filter((h) => h !== id),
      selectedHostId: state.selectedHostId === id ? null : state.selectedHostId,
    }));
  },

  setConnectionStatus: (hostId, status) =>
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [hostId]: status },
    })),
}));
