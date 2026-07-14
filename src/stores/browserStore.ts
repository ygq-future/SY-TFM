import { create } from 'zustand';
import type { SortColumn } from '../types/enums/SortColumn';
import type { SortOrder } from '../types/enums/SortOrder';
import type { AdapterCapability } from '../types/enums/AdapterCapability';
import type { RemoteFile } from '../types/generated/RemoteFile';
import * as tauri from '../lib/tauri';

/** 文件浏览状态。 */
interface BrowserState {
  /** 文件列表 */
  files: RemoteFile[];
  /** 当前路径 */
  currentPath: string;
  /** 加载中 */
  isLoading: boolean;
  /** 错误信息 */
  errorMessage: string;
  /** 选中的文件 */
  selectedFiles: RemoteFile[];
  /** 排序列 */
  sortColumn: SortColumn;
  /** 排序方向 */
  sortOrder: SortOrder;
  /** adapter 能力 */
  capabilities: AdapterCapability | null;
  /** 是否下载中 */
  isDownloading: boolean;
  /** 下载进度 */
  downloadProgress: number;
  /** 下载状态文本 */
  downloadStatusText: string;

  // 动作
  loadDirectory: (hostId: string, path: string) => Promise<void>;
  navigateToPath: (hostId: string, path: string) => Promise<void>;
  refresh: (hostId: string) => Promise<void>;
  toggleSort: (column: SortColumn) => void;
  selectFile: (file: RemoteFile | null) => void;
  selectFiles: (files: RemoteFile[]) => void;
  clearSelection: () => void;
  setCapabilities: (caps: AdapterCapability | null) => void;
  downloadSelected: (hostId: string, localDir: string) => Promise<void>;
  deleteSelected: (hostId: string) => Promise<void>;
  renameFile: (hostId: string, file: RemoteFile, newName: string) => Promise<void>;
  createDirectory: (hostId: string, name: string) => Promise<void>;
  createFile: (hostId: string, name: string) => Promise<void>;
}

/** 排序文件列表。 */
function sortFiles(files: RemoteFile[], column: SortColumn, order: SortOrder): RemoteFile[] {
  const sorted = [...files].sort((a, b) => {
    // 目录优先，".." 最前
    if (a.name === '..') return -1;
    if (b.name === '..') return 1;
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

    let cmp = 0;
    switch (column) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'size':
        cmp = a.size - b.size;
        break;
      case 'lastModified':
        cmp = a.lastModified.localeCompare(b.lastModified);
        break;
      case 'owner':
        cmp = (a.owner ?? '').localeCompare(b.owner ?? '');
        break;
      case 'permissions':
        cmp = (a.permissions ?? '').localeCompare(b.permissions ?? '');
        break;
      default:
        cmp = 0;
    }
    return order === 'ascending' ? cmp : -cmp;
  });
  return sorted;
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  files: [],
  currentPath: '/',
  isLoading: false,
  errorMessage: '',
  selectedFiles: [],
  sortColumn: 'name',
  sortOrder: 'ascending',
  capabilities: null,
  isDownloading: false,
  downloadProgress: 0,
  downloadStatusText: '',

  loadDirectory: async (hostId, path) => {
    set({ isLoading: true, errorMessage: '', selectedFiles: [] });
    try {
      const files = await tauri.listDirectory(hostId, path);
      const { sortColumn, sortOrder } = get();
      set({
        files: sortFiles(files, sortColumn, sortOrder),
        currentPath: path,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false, errorMessage: String(e) });
    }
  },

  navigateToPath: async (hostId, path) => {
    set({ isLoading: true, errorMessage: '', selectedFiles: [] });
    try {
      const result = await tauri.navigateToPath(hostId, path);
      const { sortColumn, sortOrder } = get();
      set({
        files: sortFiles(result.files, sortColumn, sortOrder),
        currentPath: result.currentPath,
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false, errorMessage: String(e) });
    }
  },

  refresh: async (hostId) => {
    const { currentPath } = get();
    await get().loadDirectory(hostId, currentPath);
  },

  toggleSort: (column) => {
    const { sortColumn, sortOrder, files } = get();
    const newOrder: SortOrder =
      column === sortColumn && sortOrder === 'ascending' ? 'descending' : 'ascending';
    set({
      sortColumn: column,
      sortOrder: newOrder,
      files: sortFiles(files, column, newOrder),
    });
  },

  selectFile: (file) => set({ selectedFiles: file ? [file] : [] }),
  selectFiles: (files) => set({ selectedFiles: files }),
  clearSelection: () => set({ selectedFiles: [] }),
  setCapabilities: (caps) => set({ capabilities: caps }),

  downloadSelected: async (hostId, localDir) => {
    const { selectedFiles } = get();
    if (selectedFiles.length === 0) return;
    set({ isDownloading: true, downloadProgress: 0, downloadStatusText: '准备下载...' });
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        set({
          downloadStatusText: `下载 ${file.name} (${i + 1}/${selectedFiles.length})`,
        });
        const localPath = `${localDir}/${file.name}`;
        await tauri.downloadFile(hostId, file.fullPath, localPath);
        set({ downloadProgress: ((i + 1) / selectedFiles.length) * 100 });
      }
      set({ isDownloading: false, downloadStatusText: '下载完成' });
    } catch (e) {
      set({ isDownloading: false, downloadStatusText: `下载失败: ${e}` });
    }
  },

  deleteSelected: async (hostId) => {
    const { selectedFiles } = get();
    for (const file of selectedFiles) {
      await tauri.deleteFile(hostId, file.fullPath);
    }
    set({ selectedFiles: [] });
    await get().refresh(hostId);
  },

  renameFile: async (hostId, file, newName) => {
    const parentPath = file.fullPath.substring(0, file.fullPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName}`;
    await tauri.moveFile(hostId, file.fullPath, newPath);
    await get().refresh(hostId);
  },

  createDirectory: async (hostId, name) => {
    const { currentPath } = get();
    const path = `${currentPath}/${name}`.replace(/\/+/g, '/');
    await tauri.createDirectory(hostId, path);
    await get().refresh(hostId);
  },

  createFile: async (hostId, name) => {
    const { currentPath } = get();
    const path = `${currentPath}/${name}`.replace(/\/+/g, '/');
    // 创建空文件：上传空内容（Phase 1 简化实现，复用 upload_file）
    // TODO: 后端实现专用 create_file 命令以避免空上传开销
    await tauri.uploadFile(hostId, path, '');
    await get().refresh(hostId);
  },
}));
