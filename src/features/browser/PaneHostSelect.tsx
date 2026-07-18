import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Server } from 'lucide-react';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import { AnchoredPortal } from '../../components/shared/AnchoredPortal';

/** 面板路径栏专用的微型已连接主机选择器。 */
export function PaneHostSelect({
  hosts,
  hostId,
  onChange,
}: {
  hosts: RemoteHost[];
  hostId: string;
  onChange: (hostId: string) => void;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = hosts.find((host) => host.id === hostId) ?? null;

  return (
    <div className="pane-host-select" ref={rootRef}>
      <button
        type="button"
        className="pane-host-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Server />
        <span>{current?.name ?? t('browser.selectHost')}</span>
        <ChevronDown />
      </button>
      {isOpen && (
        <AnchoredPortal
          anchorRef={rootRef}
          className="pane-host-menu"
          role="listbox"
          onClose={() => setIsOpen(false)}
        >
          <small>{t('browser.connectedHosts')}</small>
          {hosts.map((host) => (
            <button
              key={host.id}
              type="button"
              role="option"
              aria-selected={host.id === hostId}
              onClick={() => {
                setIsOpen(false);
                if (host.id !== hostId) onChange(host.id);
              }}
            >
              <span>
                <strong>{host.name}</strong>
                <small>{host.host}</small>
              </span>
              {host.id === hostId && <Check />}
            </button>
          ))}
        </AnchoredPortal>
      )}
    </div>
  );
}
