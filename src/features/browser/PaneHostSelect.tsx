import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LoaderCircle, Plug, Server, Unplug } from 'lucide-react';
import { AnchoredPortal } from '../../components/shared/AnchoredPortal';
import { useHostConnectionFlow } from '../connection/useHostConnectionFlow';
import { useConnectionStore } from '../../stores/connectionStore';
import { cn } from '../../lib/utils';

/** 面板路径栏主机选择器；桌面可管理全部主机，移动端仅切换已连接主机。 */
export function PaneHostSelect({
  hostId,
  onChange,
}: {
  hostId: string;
  onChange: (hostId: string) => void;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { hosts, connectedHostIds, connectionStatus, disconnectHost } = useConnectionStore();
  const isMobilePlatform =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('mobile-platform');
  const visibleHosts = isMobilePlatform
    ? hosts.filter((host) => connectedHostIds.includes(host.id))
    : hosts;
  const current = hosts.find((host) => host.id === hostId) ?? null;
  const { requestConnection, connectionDialogs } = useHostConnectionFlow((connectedHostId) => {
    setIsOpen(false);
    onChange(connectedHostId);
  });

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
          <small>{t(isMobilePlatform ? 'browser.connectedHosts' : 'hosts.label')}</small>
          {visibleHosts.map((host) => {
            const isConnected = connectedHostIds.includes(host.id);
            const status = connectionStatus[host.id];
            const isBusy = status === 'connecting' || status === 'reconnecting';
            return (
              <div
                key={host.id}
                role="option"
                tabIndex={isConnected ? 0 : -1}
                aria-selected={host.id === hostId}
                className={cn(
                  'pane-host-option',
                  host.id === hostId && 'pane-host-option--selected',
                )}
                onClick={() => {
                  if (!isConnected || host.id === hostId) return;
                  setIsOpen(false);
                  onChange(host.id);
                }}
                onKeyDown={(event) => {
                  if (!isConnected || host.id === hostId) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsOpen(false);
                    onChange(host.id);
                  }
                }}
              >
                <span className="pane-host-option-copy">
                  <strong>{host.name}</strong>
                  <small>{host.host}</small>
                </span>
                {!isMobilePlatform && (
                  <button
                    type="button"
                    className="pane-host-connection-action"
                    title={t(isConnected ? 'common.disconnect' : 'common.connect')}
                    aria-label={t(isConnected ? 'common.disconnect' : 'common.connect')}
                    disabled={isBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isConnected) {
                        setIsOpen(false);
                        void disconnectHost(host.id);
                      } else {
                        setIsOpen(false);
                        requestConnection(host);
                      }
                    }}
                  >
                    {isBusy ? (
                      <LoaderCircle className="pane-host-connection-spinner" />
                    ) : isConnected ? (
                      <Unplug />
                    ) : (
                      <Plug />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </AnchoredPortal>
      )}
      {connectionDialogs}
    </div>
  );
}
