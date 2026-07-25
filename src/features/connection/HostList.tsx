import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plug, Plus, Server, Trash2, Unplug } from 'lucide-react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useConnectionStore } from '../../stores/connectionStore';
import { cn } from '../../lib/utils';
import { HostEditDialog } from './HostEditDialog';
import { HostContextMenu } from './HostContextMenu';
import { ConfirmDialog } from '../../components/shared/Dialog';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import type { Protocol } from '../../types/enums/Protocol';
import { Select } from '../../components/ui/Select';
import { PlatformPointerSensor } from '../../lib/dragSensors';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { useHostConnectionFlow } from './useHostConnectionFlow';

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
    disconnectHost,
    deleteHost,
    reorderHosts,
  } = useConnectionStore();

  const [editingHost, setEditingHost] = useState<RemoteHost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingDeleteHost, setPendingDeleteHost] = useState<RemoteHost | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    host: RemoteHost;
    x: number;
    y: number;
  } | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [suppressAllActions, setSuppressAllActions] = useState(false);
  const [suppressedActionsHostId, setSuppressedActionsHostId] = useState<string | null>(null);
  const [mobileActiveHostDrag, setMobileActiveHostDrag] = useState<{
    id: string;
    width: number;
    height: number;
  } | null>(null);
  const hostSensors = useSensors(
    useSensor(PlatformPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 320, tolerance: 8 } }),
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

  const { requestConnection: handleConnect, connectionDialogs } =
    useHostConnectionFlow(onSelectHost);
  const handleHostDragEnd = (event: DragEndEvent) => {
    setMobileActiveHostDrag(null);
    setSuppressAllActions(true);
    const targetId = event.over?.id;
    if (!targetId || event.active.id === targetId) return;
    void reorderHosts(String(event.active.id), String(targetId)).catch(() => undefined);
  };
  const handleHostDragStart = (event: DragStartEvent) => {
    if (!document.documentElement.classList.contains('mobile-platform')) return;
    const initialRect = event.active.rect.current.initial;
    setMobileActiveHostDrag({
      id: String(event.active.id),
      width: initialRect?.width ?? 0,
      height: initialRect?.height ?? 0,
    });
  };
  const mobileActiveHost = hosts.find((host) => host.id === mobileActiveHostDrag?.id) ?? null;

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
        onDragStart={handleHostDragStart}
        onDragCancel={() => {
          setMobileActiveHostDrag(null);
          setSuppressAllActions(false);
        }}
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
                      if (document.documentElement.classList.contains('mobile-platform')) return;
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
                        <span className="sidebar-host-action-label">{t('common.edit')}</span>
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
                          <span className="sidebar-host-action-label">
                            {t('common.disconnect')}
                          </span>
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
                          <span className="sidebar-host-action-label">{t('common.connect')}</span>
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
                        <span className="sidebar-host-action-label">{t('common.delete')}</span>
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
        {mobileActiveHostDrag && (
          <ModalPortal>
            <DragOverlay adjustScale={false} dropAnimation={null} zIndex={260}>
              {mobileActiveHost && (
                <div
                  className="host-drag-overlay"
                  style={{
                    width: mobileActiveHostDrag.width || undefined,
                    minHeight: mobileActiveHostDrag.height || undefined,
                  }}
                >
                  <div className="sidebar-host-icon">
                    <Server />
                  </div>
                  <div className="sidebar-host-copy">
                    <strong>{mobileActiveHost.name}</strong>
                    <span>{formatHostEndpoint(mobileActiveHost)}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </ModalPortal>
        )}
      </DndContext>

      {isDialogOpen && <HostEditDialog host={editingHost} onClose={() => setIsDialogOpen(false)} />}
      {connectionDialogs}
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
