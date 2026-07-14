import { useEffect, useState } from 'react';
import { Server, Plus, Trash2, Plug, PlugZap, Unplug, Pencil } from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { cn } from '../../lib/utils';
import { HostEditDialog } from './HostEditDialog';
import { PasswordPromptDialog } from './PasswordPromptDialog';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import type { Protocol } from '../../types/enums/Protocol';

/** 协议默认端口。 */
function defaultPort(protocol: Protocol): number {
  switch (protocol) {
    case 'sftp':
      return 22;
    case 'webDav':
      return 443;
    case 'ftp':
      return 21;
    case 's3':
      return 443;
    case 'scp':
      return 22;
    default:
      return 0;
  }
}

/** 主机列表页面。 */
export function HostList({ onSelectHost }: { onSelectHost: (hostId: string) => void }) {
  const {
    hosts,
    connectedHostIds,
    selectedHostId,
    loadHosts,
    selectHost,
    connectHost,
    disconnectHost,
    deleteHost,
  } = useConnectionStore();

  const [editingHost, setEditingHost] = useState<RemoteHost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordPromptHost, setPasswordPromptHost] = useState<RemoteHost | null>(null);

  useEffect(() => {
    void loadHosts();
  }, [loadHosts]);

  const openNewDialog = () => {
    setEditingHost(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (host: RemoteHost) => {
    setEditingHost(host);
    setIsDialogOpen(true);
  };

  /** 连接主机：密码为空时弹出密码输入框。 */
  const handleConnect = (host: RemoteHost) => {
    if (!host.password) {
      setPasswordPromptHost(host);
    } else {
      void connectHost(host.id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">主机列表</h2>
        <button
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          onClick={openNewDialog}
        >
          <Plus className="h-4 w-4" />
          新建
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {hosts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            暂无主机，点击「新建」添加
          </div>
        ) : (
          <div className="grid gap-2">
            {hosts.map((host) => {
              const isConnected = connectedHostIds.includes(host.id);
              const isSelected = selectedHostId === host.id;
              return (
                <div
                  key={host.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50 dark:hover:bg-gray-800',
                    isSelected && 'border-blue-500 bg-blue-50 dark:bg-blue-950',
                  )}
                  onClick={() => selectHost(host.id)}
                >
                  <Server className="h-5 w-5 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{host.name}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 uppercase dark:bg-gray-700">
                        {host.protocol}
                      </span>
                    </div>
                    <div className="truncate text-xs text-gray-400">
                      {host.username}@{host.host}:{host.port || defaultPort(host.protocol)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isConnected ? (
                      <>
                        <button
                          className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900"
                          title="已连接，点击进入浏览"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectHost(host.id);
                          }}
                        >
                          <PlugZap className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded p-1.5 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900"
                          title="断开连接"
                          onClick={(e) => {
                            e.stopPropagation();
                            void disconnectHost(host.id);
                          }}
                        >
                          <Unplug className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        className="rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                        title="连接"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnect(host);
                        }}
                      >
                        <Plug className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="编辑"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(host);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900"
                      title="删除"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteHost(host.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isDialogOpen && <HostEditDialog host={editingHost} onClose={() => setIsDialogOpen(false)} />}
      {passwordPromptHost && (
        <PasswordPromptDialog
          hostName={passwordPromptHost.name}
          onConfirm={(password) => {
            void connectHost(passwordPromptHost.id, password);
            setPasswordPromptHost(null);
          }}
          onCancel={() => setPasswordPromptHost(null)}
        />
      )}
    </div>
  );
}
