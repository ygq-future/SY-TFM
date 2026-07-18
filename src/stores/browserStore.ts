import { create } from 'zustand';
import type { SortColumn } from '../types/enums/SortColumn';
import type { SortOrder } from '../types/enums/SortOrder';
import type { AdapterCapability } from '../types/enums/AdapterCapability';
import type { TransferDirection } from '../types/enums/TransferDirection';
import type { RemoteFile } from '../types/generated/RemoteFile';
import * as tauri from '../lib/tauri';
import { formatAppError } from '../lib/errors';
import i18n from '../lib/i18n';
import {
  getParentRemotePath,
  joinRemotePath,
  prependParentDirectory,
} from '../features/browser/browserViewModel';

/** 两个桌面文件面板的稳定索引。 */
export type PaneIndex = 0 | 1;

/** 单个文件面板的独立浏览状态。 */
export interface BrowserPaneState {
  hostId: string | null;
  files: RemoteFile[];
  currentPath: string;
  homePath: string;
  isLoading: boolean;
  errorMessage: string;
  selectedFiles: RemoteFile[];
  sortColumn: SortColumn;
  sortOrder: SortOrder;
  capabilities: AdapterCapability | null;
}

/** 单个可并发传输任务的界面状态。 */
export interface TransferState {
  operationId: string;
  hostId: string;
  isActive: boolean;
  isSuccessful: boolean;
  isCancelling: boolean;
  isCancelled: boolean;
  percent: number;
  message: string;
  direction: TransferDirection | null;
  currentIndex: number;
  totalCount: number;
  speed: number;
}

interface BrowserState {
  panes: [BrowserPaneState, BrowserPaneState];
  activePane: PaneIndex;
  homePaths: Record<string, string>;
  transfers: Record<string, TransferState>;
  operationMessage: string;
  operationIsError: boolean;
  setActivePane: (pane: PaneIndex) => void;
  loadDirectory: (pane: PaneIndex, hostId: string, path: string) => Promise<void>;
  initializeDirectory: (pane: PaneIndex, hostId: string) => Promise<void>;
  navigateToPath: (pane: PaneIndex, hostId: string, path: string) => Promise<void>;
  refresh: (pane: PaneIndex, hostId: string) => Promise<void>;
  toggleSort: (pane: PaneIndex, column: SortColumn) => void;
  selectFiles: (pane: PaneIndex, files: RemoteFile[]) => void;
  setCapabilities: (pane: PaneIndex, caps: AdapterCapability | null) => void;
  startTransfer: (transfer: TransferState) => void;
  updateTransfer: (operationId: string, transfer: Partial<TransferState>) => void;
  cancelTransfer: (operationId: string) => Promise<void>;
  setOperationMessage: (message: string, isError?: boolean) => void;
  downloadSelected: (pane: PaneIndex, hostId: string, localDir: string) => Promise<void>;
  deleteSelected: (pane: PaneIndex, hostId: string) => Promise<void>;
  renameFile: (pane: PaneIndex, hostId: string, file: RemoteFile, newName: string) => Promise<void>;
  moveFiles: (
    pane: PaneIndex,
    hostId: string,
    files: RemoteFile[],
    targetDirectory: string,
  ) => Promise<void>;
  transferFiles: (
    sourcePane: PaneIndex,
    sourceHostId: string,
    targetPane: PaneIndex,
    targetHostId: string,
    files: RemoteFile[],
    targetDirectory: string,
  ) => Promise<void>;
  createDirectory: (pane: PaneIndex, hostId: string, name: string) => Promise<void>;
  createFile: (pane: PaneIndex, hostId: string, name: string) => Promise<void>;
}

const createPaneState = (): BrowserPaneState => ({
  hostId: null,
  files: [],
  currentPath: '/',
  homePath: '/',
  isLoading: false,
  errorMessage: '',
  selectedFiles: [],
  sortColumn: 'name',
  sortOrder: 'ascending',
  capabilities: null,
});

let operationSequence = 0;

/** 创建在本次应用会话内唯一的传输操作 ID。 */
export function createTransferOperationId(direction: TransferDirection): string {
  operationSequence += 1;
  return `${direction}-${Date.now()}-${operationSequence}`;
}

function sortFiles(files: RemoteFile[], column: SortColumn, order: SortOrder): RemoteFile[] {
  return [...files].sort((a, b) => {
    if (a.name === '..') return -1;
    if (b.name === '..') return 1;
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let comparison = 0;
    switch (column) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = a.size - b.size;
        break;
      case 'lastModified':
        comparison = a.lastModified.localeCompare(b.lastModified);
        break;
      case 'owner':
        comparison = (a.owner ?? '').localeCompare(b.owner ?? '');
        break;
      case 'permissions':
        comparison = (a.permissions ?? '').localeCompare(b.permissions ?? '');
        break;
    }
    return order === 'ascending' ? comparison : -comparison;
  });
}

export const useBrowserStore = create<BrowserState>((set, get) => {
  const updatePane = (paneIndex: PaneIndex, patch: Partial<BrowserPaneState>) => {
    set((state) => {
      const panes: [BrowserPaneState, BrowserPaneState] = [...state.panes];
      panes[paneIndex] = { ...panes[paneIndex], ...patch };
      return { panes };
    });
  };

  return {
    panes: [createPaneState(), createPaneState()],
    activePane: 0,
    homePaths: {},
    transfers: {},
    operationMessage: '',
    operationIsError: false,

    setActivePane: (activePane) => set({ activePane }),
    startTransfer: (transfer) =>
      set((state) => ({
        transfers: {
          ...Object.fromEntries(
            Object.entries(state.transfers).filter(([, current]) => current.isActive),
          ),
          [transfer.operationId]: transfer,
        },
      })),
    updateTransfer: (operationId, transfer) =>
      set((state) => {
        const current = state.transfers[operationId];
        if (!current) return state;
        return {
          transfers: {
            ...state.transfers,
            [operationId]: { ...current, ...transfer },
          },
        };
      }),
    cancelTransfer: async (operationId) => {
      const current = get().transfers[operationId];
      if (!current?.isActive || current.isCancelling) return;
      get().updateTransfer(operationId, {
        isCancelling: true,
        message: i18n.t('transfer.cancelling'),
      });
      const accepted = await tauri.cancelTransfer(operationId);
      if (!accepted) {
        get().updateTransfer(operationId, {
          isActive: false,
          isCancelling: false,
          message: i18n.t('transfer.cancelUnavailable'),
        });
      }
    },
    setOperationMessage: (operationMessage, operationIsError = false) =>
      set({ operationMessage, operationIsError }),

    loadDirectory: async (paneIndex, hostId, path) => {
      if (get().panes[paneIndex].hostId !== hostId) return;
      updatePane(paneIndex, { isLoading: true, errorMessage: '', selectedFiles: [] });
      try {
        const files = await tauri.listDirectory(hostId, path);
        if (get().panes[paneIndex].hostId !== hostId) return;
        const pane = get().panes[paneIndex];
        updatePane(paneIndex, {
          files: sortFiles(
            prependParentDirectory(files, path || '/'),
            pane.sortColumn,
            pane.sortOrder,
          ),
          currentPath: path || '/',
          isLoading: false,
        });
      } catch (error) {
        if (get().panes[paneIndex].hostId !== hostId) return;
        updatePane(paneIndex, { isLoading: false, errorMessage: formatAppError(error) });
      }
    },

    initializeDirectory: async (paneIndex, hostId) => {
      updatePane(paneIndex, {
        hostId,
        files: [],
        currentPath: '/',
        homePath: '/',
        isLoading: true,
        errorMessage: '',
        selectedFiles: [],
      });
      try {
        const cachedHome = get().homePaths[hostId];
        const workingDirectory = cachedHome || (await tauri.getWorkingDirectory(hostId)) || '/';
        if (get().panes[paneIndex].hostId !== hostId) return;
        if (!cachedHome) {
          set((state) => ({ homePaths: { ...state.homePaths, [hostId]: workingDirectory } }));
        }
        const files = await tauri.listDirectory(hostId, workingDirectory);
        if (get().panes[paneIndex].hostId !== hostId) return;
        const pane = get().panes[paneIndex];
        updatePane(paneIndex, {
          files: sortFiles(
            prependParentDirectory(files, workingDirectory),
            pane.sortColumn,
            pane.sortOrder,
          ),
          currentPath: workingDirectory,
          homePath: workingDirectory,
          isLoading: false,
        });
      } catch (error) {
        if (get().panes[paneIndex].hostId !== hostId) return;
        updatePane(paneIndex, { isLoading: false, errorMessage: formatAppError(error) });
      }
    },

    navigateToPath: async (paneIndex, hostId, path) => {
      await get().loadDirectory(paneIndex, hostId, path);
    },

    refresh: async (paneIndex, hostId) => {
      await get().loadDirectory(paneIndex, hostId, get().panes[paneIndex].currentPath);
    },

    toggleSort: (paneIndex, column) => {
      const pane = get().panes[paneIndex];
      const sortOrder: SortOrder =
        column === pane.sortColumn && pane.sortOrder === 'ascending' ? 'descending' : 'ascending';
      updatePane(paneIndex, {
        sortColumn: column,
        sortOrder,
        files: sortFiles(pane.files, column, sortOrder),
      });
    },

    selectFiles: (paneIndex, selectedFiles) => updatePane(paneIndex, { selectedFiles }),
    setCapabilities: (paneIndex, capabilities) => updatePane(paneIndex, { capabilities }),

    downloadSelected: async (paneIndex, hostId, localDir) => {
      const selectedFiles = get().panes[paneIndex].selectedFiles;
      if (selectedFiles.length === 0) return;
      const operationId = createTransferOperationId('remoteToLocal');
      get().startTransfer({
        operationId,
        hostId,
        isActive: true,
        isSuccessful: false,
        isCancelling: false,
        isCancelled: false,
        percent: 0,
        direction: 'remoteToLocal',
        message: i18n.t('transfer.preparingDownload'),
        currentIndex: 0,
        totalCount: selectedFiles.length,
        speed: 0,
      });
      await tauri.beginTransfer(operationId, [hostId]);
      try {
        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          get().updateTransfer(operationId, {
            message: i18n.t('browser.downloading', { name: file.name }),
            currentIndex: index + 1,
            totalCount: selectedFiles.length,
            percent: 0,
          });
          await tauri.downloadFile(
            hostId,
            file.fullPath,
            localDir,
            file.name,
            file.isDirectory,
            operationId,
          );
        }
        get().updateTransfer(operationId, {
          isActive: false,
          isSuccessful: true,
          isCancelled: false,
          percent: 100,
          message: i18n.t('transfer.downloadDone'),
          currentIndex: selectedFiles.length,
          totalCount: selectedFiles.length,
          isCancelling: false,
        });
      } catch (error) {
        const cancelled =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'operation_cancelled';
        get().updateTransfer(operationId, {
          isActive: false,
          isSuccessful: false,
          isCancelling: false,
          isCancelled: cancelled,
          message: cancelled
            ? i18n.t('transfer.cancelled')
            : i18n.t('transfer.downloadFailed', { error: formatAppError(error) }),
        });
        if (!cancelled) throw error;
      } finally {
        await tauri.finishTransfer(operationId);
      }
    },

    deleteSelected: async (paneIndex, hostId) => {
      for (const file of get().panes[paneIndex].selectedFiles) {
        await tauri.deleteFile(hostId, file.fullPath);
      }
      updatePane(paneIndex, { selectedFiles: [] });
      await get().refresh(paneIndex, hostId);
    },

    renameFile: async (paneIndex, hostId, file, newName) => {
      const parentPath = getParentRemotePath(file.fullPath);
      await tauri.moveFile(hostId, file.fullPath, joinRemotePath(parentPath, newName));
      await get().refresh(paneIndex, hostId);
    },

    moveFiles: async (paneIndex, hostId, files, targetDirectory) => {
      for (const file of files) {
        if (file.name === '..' || file.fullPath === targetDirectory) continue;
        await tauri.moveFile(hostId, file.fullPath, joinRemotePath(targetDirectory, file.name));
      }
      updatePane(paneIndex, { selectedFiles: [] });
      get().setOperationMessage(
        i18n.t('transfer.moved', { count: files.length, target: targetDirectory }),
      );
      await get().refresh(paneIndex, hostId);
    },

    transferFiles: async (
      sourcePane,
      sourceHostId,
      targetPane,
      targetHostId,
      files,
      targetDirectory,
    ) => {
      const transferable = files.filter((file) => file.name !== '..');
      if (transferable.length === 0) return;
      const operationId = createTransferOperationId('remoteToRemote');
      get().startTransfer({
        operationId,
        hostId: sourceHostId,
        isActive: true,
        isSuccessful: false,
        isCancelling: false,
        isCancelled: false,
        percent: 0,
        direction: 'remoteToRemote',
        message: i18n.t('transfer.preparingCrossPane'),
        currentIndex: 0,
        totalCount: transferable.length,
        speed: 0,
      });
      await tauri.beginTransfer(operationId, [sourceHostId, targetHostId]);
      try {
        for (let index = 0; index < transferable.length; index += 1) {
          const file = transferable[index];
          get().updateTransfer(operationId, {
            percent: (index / transferable.length) * 100,
            currentIndex: index + 1,
            totalCount: transferable.length,
            message: i18n.t('transfer.transferring', {
              name: file.name,
              current: index + 1,
              total: transferable.length,
            }),
          });
          await tauri.transferEntry(
            sourceHostId,
            targetHostId,
            file.fullPath,
            joinRemotePath(targetDirectory, file.name),
            file.isDirectory,
            operationId,
          );
        }
        updatePane(sourcePane, { selectedFiles: [] });
        get().updateTransfer(operationId, {
          isActive: false,
          isSuccessful: true,
          isCancelled: false,
          percent: 100,
          message: i18n.t('transfer.crossPaneDone'),
          currentIndex: transferable.length,
          totalCount: transferable.length,
          isCancelling: false,
        });
        await get().refresh(targetPane, targetHostId);
      } catch (error) {
        const cancelled =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'operation_cancelled';
        get().updateTransfer(operationId, {
          isActive: false,
          isSuccessful: false,
          isCancelling: false,
          isCancelled: cancelled,
          message: cancelled
            ? i18n.t('transfer.cancelled')
            : i18n.t('transfer.transferFailed', { error: formatAppError(error) }),
        });
        if (!cancelled) throw error;
      } finally {
        await tauri.finishTransfer(operationId);
      }
    },

    createDirectory: async (paneIndex, hostId, name) => {
      const path = joinRemotePath(get().panes[paneIndex].currentPath, name);
      await tauri.createDirectory(hostId, path);
      await get().refresh(paneIndex, hostId);
    },

    createFile: async (paneIndex, hostId, name) => {
      const path = joinRemotePath(get().panes[paneIndex].currentPath, name);
      const operationId = createTransferOperationId('localToRemote');
      await tauri.beginTransfer(operationId, [hostId]);
      try {
        await tauri.uploadContent(hostId, path, '', operationId);
      } finally {
        await tauri.finishTransfer(operationId);
      }
      await get().refresh(paneIndex, hostId);
    },
  };
});
