import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plug, Plus, Server, Trash2, Unplug } from 'lucide-react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useConnectionStore } from '../../stores/connectionStore';
import { cn } from '../../lib/utils';
import { HostEditDialog } from './HostEditDialog';
import { HostContextMenu } from './HostContextMenu';
import { PasswordPromptDialog } from './PasswordPromptDialog';
import { ConfirmDialog } from '../../components/shared/Dialog';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import type { Protocol } from '../../types/enums/Protocol';
import { Select } from '../../components/ui/Select';
import { getHostKeyUnknownDetails, hasAppErrorCode } from '../../lib/errors';

/** 协议默认端口。 */
function defaultPort(protocol: Protocol): number {
  switch (protocol) {
    case 'sftp':
      return 22;
    case 'webdav':
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

/** 主机卡片使用与协议语义一致的紧凑地址。 */
function formatHostEndpoint(host: RemoteHost): string {
  if (host.protocol === 'webdav') {
    const address = host.host.replace(/^https?:\/\//i, '');
    return `${host.https ? 'https' : 'http'}://${address}`;
  }
  return `${host.host}:${host.port || defaultPort(host.protocol)}`;
}

function SortableHostRow({
  hostId,
  className,
  disabled,
  suppressActions,
  onClick,
  onDoubleClick,
  onContextMenu,
  onPointerLeave,
  children,
}: {
  hostId: string;
  className: string;
  disabled: boolean;
  suppressActions: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: hostId,
    disabled,
  });
  return (
    <article
      ref={setNodeRef}
      className={cn(
        className,
        isDragging && 'sidebar-host-row--dragging',
        suppressActions && 'sidebar-host-row--actions-suppressed',
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onPointerLeave={onPointerLeave}
      {...listeners}
      {...attributes}
    >
      {children}
    </article>
  );
}

/** 紧凑主机侧栏。 */
export function HostList({ onSelectHost }: { onSelectHost: (hostId: string) => void }) {
  const { t } = useTranslation();
  const {
    hosts,
    connectedHostIds,
    selectedHostId,
    connectionStatus,
    isLoading,
    isReordering,
    loadHosts,
    selectHost,
    connectHost,
    disconnectHost,
    updateHost,
    deleteHost,
    reorderHosts,
  } = useConnectionStore();

  const [editingHost, setEditingHost] = useState<RemoteHost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordPromptHost, setPasswordPromptHost] = useState<RemoteHost | null>(null);
  const [pendingDeleteHost, setPendingDeleteHost] = useState<RemoteHost | null>(null);
  const [pendingHostKey, setPendingHostKey] = useState<{
    host: RemoteHost;
    password?: string;
    rememberPassword: boolean;
    fingerprint: string;
    endpoint: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    host: RemoteHost;
    x: number;
    y: number;
  } | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [suppressAllActions, setSuppressAllActions] = useState(false);
  const [suppressedActionsHostId, setSuppressedActionsHostId] = useState<string | null>(null);
  const hostSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    void loadHosts();
  }, [loadHosts]);

  useEffect(() => {
    if (!suppressAllActions) return;
    const releaseSuppression = () => setSuppressAllActions(false);
    window.addEventListener('pointermove', releaseSuppression, { once: true });
    return () => window.removeEventListener('pointermove', releaseSuppression);
  }, [suppressAllActions]);

  const tags = useMemo(
    () =>
      Array.from(
        new Set(
          hosts.flatMap((host) =>
            host.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ),
      ).sort(),
    [hosts],
  );
  const visibleHosts = tagFilter
    ? hosts.filter((host) =>
        host.tags
          .split(',')
          .map((tag) => tag.trim())
          .includes(tagFilter),
      )
    : hosts;
  const openNewDialog = () => {
    setEditingHost(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (host: RemoteHost) => {
    setEditingHost(host);
    setIsDialogOpen(true);
  };

  const captureUnknownHostKey = (
    host: RemoteHost,
    password: string | undefined,
    rememberPassword: boolean,
    error: unknown,
  ) => {
    const details = getHostKeyUnknownDetails(error);
    if (!details) return false;
    useConnectionStore.setState({ error: null });
    setPendingHostKey({
      host,
      password,
      rememberPassword,
      fingerprint: details.actualFingerprint,
      endpoint: `${details.host}:${details.port}`,
    });
    return true;
  };

  const connectAndOpen = async (host: RemoteHost, password?: string, rememberPassword = false) => {
    try {
      await connectHost(host.id, password);
      onSelectHost(host.id);
    } catch (error) {
      if (captureUnknownHostKey(host, password, rememberPassword, error)) return;
      throw error;
    }
  };

  const handleConnect = (host: RemoteHost) => {
    if (!host.password) setPasswordPromptHost(host);
    else {
      void connectAndOpen(host).catch((error: unknown) => {
        if (hasAppErrorCode(error, 'crypto_decrypt_failed')) {
          useConnectionStore.setState({ error: null });
          setPasswordPromptHost(host);
        }
      });
    }
  };
  const handleHostDragEnd = (event: DragEndEvent) => {
    setSuppressAllActions(true);
    const targetId = event.over?.id;
    if (!targetId || event.active.id === targetId) return;
    void reorderHosts(String(event.active.id), String(targetId)).catch(() => undefined);
  };

  return (
    <aside className="host-sidebar" aria-label={t('hosts.list')}>
      <div className="host-sidebar-header">
        <h2>{t('hosts.label')}</h2>
        <div>
          <button className="sidebar-text-button" type="button" onClick={openNewDialog}>
            <Plus />
            {t('hosts.add')}
          </button>
        </div>
      </div>

      <div className="host-filter">
        <span className="sr-only">{t('hosts.filter')}</span>
        <Select
          ariaLabel={t('hosts.filter')}
          className="host-filter-select"
          value={tagFilter}
          options={[
            { value: '', label: t('hosts.allTags') },
            ...tags.map((tag) => ({ value: tag, label: tag })),
          ]}
          onValueChange={setTagFilter}
        />
      </div>

      <DndContext
        sensors={hostSensors}
        autoScroll={false}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragCancel={() => setSuppressAllActions(false)}
        onDragEnd={handleHostDragEnd}
      >
        <SortableContext
          items={visibleHosts.map((host) => host.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="host-sidebar-list">
            {isLoading ? (
              <div className="sidebar-empty">{t('hosts.loading')}</div>
            ) : visibleHosts.length === 0 ? (
              <button
                className="sidebar-empty sidebar-empty--action"
                type="button"
                onClick={openNewDialog}
              >
                <Plus />
                <span>{t(hosts.length === 0 ? 'hosts.addFirst' : 'hosts.noMatch')}</span>
              </button>
            ) : (
              visibleHosts.map((host) => {
                const isConnected = connectedHostIds.includes(host.id);
                const isSelected = selectedHostId === host.id;
                const status = connectionStatus[host.id];
                const isOnline = status === 'connected';
                const firstTag = host.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .find(Boolean);

                return (
                  <SortableHostRow
                    key={host.id}
                    hostId={host.id}
                    disabled={isReordering}
                    suppressActions={suppressAllActions || suppressedActionsHostId === host.id}
                    className={cn('sidebar-host-row', isSelected && 'sidebar-host-row--selected')}
                    onClick={() => {
                      setSuppressedActionsHostId(host.id);
                      selectHost(host.id);
                    }}
                    onDoubleClick={() => {
                      if (isConnected) onSelectHost(host.id);
                      else handleConnect(host);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      selectHost(host.id);
                      setContextMenu({ host, x: event.clientX, y: event.clientY });
                    }}
                    onPointerLeave={() => {
                      if (suppressedActionsHostId === host.id) setSuppressedActionsHostId(null);
                    }}
                  >
                    <div className="sidebar-host-icon">
                      <Server />
                    </div>
                    <div className="sidebar-host-copy">
                      <strong>{host.name}</strong>
                      <span>{formatHostEndpoint(host)}</span>
                    </div>
                    {firstTag && <span className="sidebar-host-tag">{firstTag}</span>}
                    <div
                      className="sidebar-host-actions"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        title={t('common.edit')}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSuppressedActionsHostId(host.id);
                          openEditDialog(host);
                        }}
                      >
                        <Pencil />
                      </button>
                      {isConnected ? (
                        <button
                          type="button"
                          title={t('common.disconnect')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSuppressedActionsHostId(host.id);
                            void disconnectHost(host.id);
                          }}
                        >
                          <Unplug />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={t('common.connect')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSuppressedActionsHostId(host.id);
                            handleConnect(host);
                          }}
                        >
                          <Plug />
                        </button>
                      )}
                      <button
                        type="button"
                        title={t('common.delete')}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSuppressedActionsHostId(host.id);
                          setPendingDeleteHost(host);
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                    <span
                      className={cn(
                        'sidebar-connection-dot',
                        isOnline && 'sidebar-connection-dot--online',
                        (status === 'connecting' || status === 'reconnecting') &&
                          'sidebar-connection-dot--busy',
                      )}
                    />
                  </SortableHostRow>
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      {isDialogOpen && <HostEditDialog host={editingHost} onClose={() => setIsDialogOpen(false)} />}
      {passwordPromptHost && (
        <PasswordPromptDialog
          hostName={passwordPromptHost.name}
          onConfirm={(password, remember) => {
            const host = passwordPromptHost;
            setPasswordPromptHost(null);
            void connectAndOpen(host, password, remember).catch(() => undefined);
          }}
          onCancel={() => setPasswordPromptHost(null)}
        />
      )}
      {contextMenu && (
        <HostContextMenu
          host={contextMenu.host}
          x={contextMenu.x}
          y={contextMenu.y}
          isConnected={connectedHostIds.includes(contextMenu.host.id)}
          onClose={() => setContextMenu(null)}
          onEdit={() => openEditDialog(contextMenu.host)}
          onConnect={() => handleConnect(contextMenu.host)}
          onDisconnect={() => void disconnectHost(contextMenu.host.id)}
          onDelete={() => setPendingDeleteHost(contextMenu.host)}
        />
      )}
      {pendingHostKey && (
        <ConfirmDialog
          title={t('hostKey.trustTitle')}
          message={
            <div className="host-key-message">
              <p>{t('hostKey.trustMessage', { endpoint: pendingHostKey.endpoint })}</p>
              <code>{pendingHostKey.fingerprint}</code>
            </div>
          }
          confirmLabel={t('hostKey.trust')}
          onConfirm={() => {
            const pending = pendingHostKey;
            setPendingHostKey(null);
            useConnectionStore.setState({ error: null });
            void (async () => {
              const trustedHost = {
                ...pending.host,
                password: pending.rememberPassword ? (pending.password ?? '') : '',
                sftpHostKeyFingerprint: pending.fingerprint,
              };
              await updateHost(trustedHost);
              await connectAndOpen(trustedHost, pending.password);
            })().catch(() => undefined);
          }}
          onCancel={() => setPendingHostKey(null)}
        />
      )}
      {pendingDeleteHost && (
        <ConfirmDialog
          title={t('hosts.deleteTitle')}
          message={t('hosts.deleteMessage', { name: pendingDeleteHost.name })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => {
            const host = pendingDeleteHost;
            setPendingDeleteHost(null);
            void (async () => {
              if (connectedHostIds.includes(host.id)) await disconnectHost(host.id);
              await deleteHost(host.id);
            })();
          }}
          onCancel={() => setPendingDeleteHost(null)}
        />
      )}
    </aside>
  );
}
