import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plug, Trash2, Unplug } from 'lucide-react';
import { ModalPortal } from '../../components/shared/ModalPortal';
import type { RemoteHost } from '../../types/generated/RemoteHost';

/** 主机卡片右键菜单。 */
export function HostContextMenu({
  x,
  y,
  host,
  isConnected,
  onClose,
  onEdit,
  onConnect,
  onDisconnect,
  onDelete,
}: {
  x: number;
  y: number;
  host: RemoteHost;
  isConnected: boolean;
  onClose: () => void;
  onEdit: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - 190));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - 180));
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <ModalPortal>
      <div
        ref={ref}
        className="context-menu host-context-menu"
        role="menu"
        aria-label={t('hosts.actions', { name: host.name })}
        style={{ left: adjustedX, top: adjustedY }}
      >
        <p className="context-label">{host.name}</p>
        <HostMenuItem icon={Pencil} label={t('hosts.editConnection')} onClick={() => run(onEdit)} />
        {isConnected ? (
          <HostMenuItem
            icon={Unplug}
            label={t('hosts.disconnectHost')}
            onClick={() => run(onDisconnect)}
          />
        ) : (
          <HostMenuItem icon={Plug} label={t('hosts.connectHost')} onClick={() => run(onConnect)} />
        )}
        <div className="context-divider" />
        <HostMenuItem
          icon={Trash2}
          label={t('hosts.deleteHost')}
          danger
          onClick={() => run(onDelete)}
        />
      </div>
    </ModalPortal>
  );
}

function HostMenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? 'context-item context-item--danger' : 'context-item'}
      onClick={onClick}
    >
      <Icon />
      <span>{label}</span>
    </button>
  );
}
