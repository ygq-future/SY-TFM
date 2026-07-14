import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw, FolderPlus, Download, Trash2, Edit } from 'lucide-react';

import { getAppInfo, getSupportedProtocols, type AppInfo } from './lib/tauri';
import type { Protocol } from './types/enums/Protocol';
import type { RemoteFile } from './types/generated/RemoteFile';
import { useConnectionStore } from './stores/connectionStore';
import { useBrowserStore } from './stores/browserStore';
import { HostList } from './features/connection/HostList';
import { Breadcrumb } from './features/browser/Breadcrumb';
import { FileList } from './features/browser/FileList';
import { DownloadBar } from './features/browser/DownloadBar';
import { UploadZone } from './features/browser/UploadZone';
import { ContextMenu } from './features/browser/ContextMenu';
import { ConfirmDialog, InputDialog } from './components/shared/Dialog';
import { ToastProvider } from './components/shared/ToastProvider';
import { toast } from 'sonner';

/** 文件浏览页面。 */
function BrowserPage({ hostId, onBack }: { hostId: string; onBack: () => void }) {
  const {
    files,
    currentPath,
    isLoading,
    selectedFiles,
    capabilities,
    sortColumn,
    sortOrder,
    loadDirectory,
    navigateToPath,
    refresh,
    toggleSort,
    selectFiles,
    setCapabilities,
    downloadSelected,
    deleteSelected,
    renameFile,
    createDirectory,
    createFile,
  } = useBrowserStore();
  const { hostCapabilities } = useConnectionStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: RemoteFile | null;
  } | null>(null);
  const [dialog, setDialog] = useState<
    | { type: 'mkdir' }
    | { type: 'createFile' }
    | { type: 'rename'; file: RemoteFile }
    | { type: 'deleteConfirm' }
    | null
  >(null);

  useEffect(() => {
    const caps = hostCapabilities[hostId] ?? null;
    setCapabilities(caps);
    void loadDirectory(hostId, '/');
  }, [hostId, hostCapabilities, setCapabilities, loadDirectory]);

  const handleOpen = useCallback(
    (file: RemoteFile) => {
      if (file.isDirectory && file.name !== '..') {
        void navigateToPath(hostId, file.fullPath);
      } else if (file.name === '..') {
        const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
        void navigateToPath(hostId, parent);
      }
    },
    [hostId, navigateToPath, currentPath],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, file: RemoteFile | null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      // 使用浏览器默认下载目录（Phase 2 支持自定义）
      const localDir = await getDownloadDir();
      await downloadSelected(hostId, localDir);
      toast.success('下载完成');
    } catch (e) {
      toast.error(`下载失败: ${e}`);
    }
  }, [hostId, downloadSelected]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteSelected(hostId);
      toast.success('删除完成');
    } catch (e) {
      toast.error(`删除失败: ${e}`);
    }
  }, [hostId, deleteSelected]);

  return (
    <div
      className="relative flex h-full flex-col"
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* 工具栏 */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
        <div className="h-4 w-px bg-gray-300" />
        <button
          className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="刷新"
          onClick={() => void refresh(hostId)}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="新建文件夹"
          onClick={() => setDialog({ type: 'mkdir' })}
        >
          <FolderPlus className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-gray-300" />
        <button
          className="rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
          title="下载"
          disabled={selectedFiles.length === 0}
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900"
          title="重命名"
          disabled={selectedFiles.length !== 1}
          onClick={() => {
            if (selectedFiles[0]) setDialog({ type: 'rename', file: selectedFiles[0] });
          }}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900"
          title="删除"
          disabled={selectedFiles.length === 0}
          onClick={() => setDialog({ type: 'deleteConfirm' })}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {/* 面包屑 */}
      <Breadcrumb path={currentPath} onNavigate={(p) => void navigateToPath(hostId, p)} />
      {/* 文件列表 + 拖拽上传 */}
      <div className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-gray-400">加载中...</div>
        ) : files.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">空目录</div>
        ) : (
          <FileList
            files={files}
            capabilities={capabilities}
            onOpen={handleOpen}
            onSelect={selectFiles}
            selectedFiles={selectedFiles}
            onSort={toggleSort}
            sortColumn={sortColumn}
            sortOrder={sortOrder}
          />
        )}
        <UploadZone hostId={hostId} />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onMkdir={() => setDialog({ type: 'mkdir' })}
          onCreateFile={() => setDialog({ type: 'createFile' })}
          onRename={() => {
            if (contextMenu.file) setDialog({ type: 'rename', file: contextMenu.file });
          }}
          onDelete={() => setDialog({ type: 'deleteConfirm' })}
          onDownload={handleDownload}
          onUpload={() => {
            /* TODO: 文件选择器上传 */
          }}
        />
      )}

      {/* 对话框 */}
      {dialog?.type === 'mkdir' && (
        <InputDialog
          title="新建文件夹"
          label="文件夹名称"
          confirmLabel="创建"
          onConfirm={async (name) => {
            setDialog(null);
            try {
              await createDirectory(hostId, name);
              toast.success('文件夹已创建');
            } catch (e) {
              toast.error(`创建失败: ${e}`);
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'createFile' && (
        <InputDialog
          title="新建文件"
          label="文件名"
          confirmLabel="创建"
          onConfirm={async (name) => {
            setDialog(null);
            try {
              await createFile(hostId, name);
              toast.success('文件已创建');
            } catch (e) {
              toast.error(`创建失败: ${e}`);
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'rename' && (
        <InputDialog
          title="重命名"
          label="新名称"
          defaultValue={dialog.file.name}
          confirmLabel="重命名"
          onConfirm={async (name) => {
            const file = dialog.file;
            setDialog(null);
            try {
              await renameFile(hostId, file, name);
              toast.success('重命名成功');
            } catch (e) {
              toast.error(`重命名失败: ${e}`);
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'deleteConfirm' && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除选中的 ${selectedFiles.length} 个文件/文件夹吗？此操作不可撤销。`}
          confirmLabel="删除"
          danger
          onConfirm={() => {
            setDialog(null);
            void handleDelete();
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {/* 下载进度条 */}
      <DownloadBar />
    </div>
  );
}

/** 获取下载目录（Phase 1 简化：使用 Downloads 目录）。 */
async function getDownloadDir(): Promise<string> {
  // Phase 2: 通过 Tauri dialog API 让用户选择
  // Phase 1: 使用平台默认 Downloads 目录
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const handle = await (
        window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }
      ).showDirectoryPicker();
      return handle.name;
    } catch {
      // 用户取消
    }
  }
  return '~/Downloads';
}

function AppInner() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [browsingHostId, setBrowsingHostId] = useState<string | null>(null);
  const { connectedHostIds } = useConnectionStore();

  useEffect(() => {
    getAppInfo()
      .then(setInfo)
      .catch(() => {
        /* 非 Tauri 环境忽略 */
      });
    getSupportedProtocols()
      .then(setProtocols)
      .catch(() => {
        /* 非 Tauri 环境忽略 */
      });
  }, []);

  // 如果浏览的主机断开了，返回主机列表
  useEffect(() => {
    if (browsingHostId && !connectedHostIds.includes(browsingHostId)) {
      setBrowsingHostId(null);
    }
  }, [browsingHostId, connectedHostIds]);

  return (
    <main className="flex h-full flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* 标题栏 */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">SY-TFM</h1>
          {info && <span className="text-xs text-gray-400">v{info.version}</span>}
        </div>
        <div className="text-xs text-gray-400">
          {t('supportedProtocols')}: {protocols.join(', ')}
        </div>
      </header>
      {/* 主体 */}
      <div className="flex-1 overflow-hidden">
        {browsingHostId ? (
          <BrowserPage hostId={browsingHostId} onBack={() => setBrowsingHostId(null)} />
        ) : (
          <HostList onSelectHost={(id) => setBrowsingHostId(id)} />
        )}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
