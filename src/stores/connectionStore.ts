import { create } from 'zustand';
import type { AdapterCapability } from '../types/enums/AdapterCapability';
import type { ConnectionStatus } from '../types/enums/ConnectionStatus';
import type { RemoteHost } from '../types/generated/RemoteHost';
import * as tauri from '../lib/tauri';
import { formatAppError } from '../lib/errors';

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
  /** 主机顺序正在持久化 */
  isReordering: boolean;
  /** 错误信息 */
  error: string | null;

  // 动作
  loadHosts: () => Promise<void>;
  refreshHosts: () => Promise<void>;
  selectHost: (id: string | null) => void;
  connectHost: (id: string, password?: string) => Promise<void>;
  disconnectHost: (id: string) => Promise<void>;
  addHost: (host: RemoteHost) => Promise<void>;
  updateHost: (host: RemoteHost, clearPassword?: boolean) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;
  reorderHosts: (sourceId: string, targetId: string) => Promise<void>;
  setConnectionStatus: (hostId: string, status: ConnectionStatus) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  hosts: [],
  connectedHostIds: [],
  selectedHostId: null,
  connectionStatus: {},
  hostCapabilities: {},
  isLoading: false,
  isReordering: false,
  error: null,

  loadHosts: async () => {
    set({ isLoading: true, error: null });
    try {
      const hosts = await tauri.getHosts();
      set({ hosts, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: formatAppError(e) });
    }
  },

  refreshHosts: async () => {
    try {
      const hosts = await tauri.getHosts();
      set((state) =>
        JSON.stringify(state.hosts) === JSON.stringify(hosts) ? state : { hosts, error: null },
      );
    } catch (e) {
      set({ error: formatAppError(e) });
    }
  },

  selectHost: (id) => set({ selectedHostId: id }),

  connectHost: async (id, password) => {
    set((state) => ({
      error: null,
      connectionStatus: {
        ...state.connectionStatus,
        [id]: 'connecting' as ConnectionStatus,
      },
    }));
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
      set((state) => ({
        error: formatAppError(e),
        connectedHostIds: state.connectedHostIds.filter((hostId) => hostId !== id),
        connectionStatus: {
          ...state.connectionStatus,
          [id]: 'error' as ConnectionStatus,
        },
      }));
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
      set({ error: formatAppError(e) });
      throw e;
    }
  },

  addHost: async (host) => {
    await tauri.saveHost(host);
    set({ hosts: await tauri.getHosts() });
  },

  updateHost: async (host, clearPassword = false) => {
    await tauri.saveHost(host, clearPassword);
    set({ hosts: await tauri.getHosts() });
  },

  deleteHost: async (id) => {
    await tauri.deleteHost(id);
    set((state) => ({
      hosts: state.hosts.filter((h) => h.id !== id),
      connectedHostIds: state.connectedHostIds.filter((h) => h !== id),
      selectedHostId: state.selectedHostId === id ? null : state.selectedHostId,
    }));
  },

  reorderHosts: async (sourceId, targetId) => {
    const state = get();
    if (state.isReordering || sourceId === targetId) return;
    const sourceIndex = state.hosts.findIndex((host) => host.id === sourceId);
    const targetIndex = state.hosts.findIndex((host) => host.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const previousHosts = state.hosts;
    const hosts = [...previousHosts];
    const [moved] = hosts.splice(sourceIndex, 1);
    hosts.splice(targetIndex, 0, moved);
    set({ hosts, isReordering: true, error: null });
    try {
      await tauri.reorderHosts(hosts.map((host) => host.id));
      set({ isReordering: false });
    } catch (error) {
      set({ hosts: previousHosts, isReordering: false, error: formatAppError(error) });
      throw error;
    }
  },

  setConnectionStatus: (hostId, status) =>
    set((state) => {
      const isConnected = status === 'connected';
      const isDisconnected = status === 'disconnected';
      const isError = status === 'error';
      return {
        connectionStatus: { ...state.connectionStatus, [hostId]: status },
        connectedHostIds: isConnected
          ? state.connectedHostIds.includes(hostId)
            ? state.connectedHostIds
            : [...state.connectedHostIds, hostId]
          : isDisconnected || isError
            ? state.connectedHostIds.filter((id) => id !== hostId)
            : state.connectedHostIds,
      };
    }),
}));
