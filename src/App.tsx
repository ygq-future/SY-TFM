import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw, FolderPlus, Download, Trash2, Edit } from 'lucide-react';

import { getAppInfo, getSupportedProtocols, type AppInfo } from './lib/tauri';
import type { Protocol } from './types/enums/Protocol';
import { useConnectionStore } from './stores/connectionStore';
import { useBrowserStore } from './stores/browserStore';
import { HostList } from './features/connection/HostList';
import { Breadcrumb } from './features/browser/Breadcrumb';
import { FileList } from './features/browser/FileList';

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
  } = useBrowserStore();
  const { hostCapabilities } = useConnectionStore();

  useEffect(() => {
    const caps = hostCapabilities[hostId] ?? null;
    setCapabilities(caps);
    void loadDirectory(hostId, '/');
  }, [hostId, hostCapabilities, setCapabilities, loadDirectory]);

  const handleOpen = (file: { fullPath: string; isDirectory: boolean; name: string }) => {
    if (file.isDirectory && file.name !== '..') {
      void navigateToPath(hostId, file.fullPath);
    } else if (file.name === '..') {
      const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
      void navigateToPath(hostId, parent);
    }
  };

  return (
    <div className="flex h-full flex-col">
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
          onClick={() => {
            /* TODO: 新建文件夹对话框 */
          }}
        >
          <FolderPlus className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-gray-300" />
        <button
          className="rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
          title="下载"
          disabled={selectedFiles.length === 0}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900"
          title="重命名"
          disabled={selectedFiles.length !== 1}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900"
          title="删除"
          disabled={selectedFiles.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {/* 面包屑 */}
      <Breadcrumb path={currentPath} onNavigate={(p) => void navigateToPath(hostId, p)} />
      {/* 文件列表 */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-gray-400">加载中...</div>
      ) : files.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-gray-400">空目录</div>
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
    </div>
  );
}

export default function App() {
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
