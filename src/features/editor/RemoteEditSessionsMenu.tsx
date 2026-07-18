import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FilePenLine, LoaderCircle, X } from 'lucide-react';
import { listRemoteEditSessions, stopRemoteEdit } from '../../lib/tauri';
import { formatAppError } from '../../lib/errors';
import type { RemoteEditSessionInfo } from '../../types/generated/RemoteEditSessionInfo';
import { AnchoredPortal } from '../../components/shared/AnchoredPortal';

/** 路径栏中的当前主机 Remote Edit 监听入口。 */
export function RemoteEditSessionsMenu({
  hostId,
  refreshKey,
  onOpen,
}: {
  hostId: string;
  refreshKey: number;
  onOpen: (session: RemoteEditSessionInfo) => Promise<void>;
}) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const currentHostIdRef = useRef(hostId);
  const previousHostIdRef = useRef(hostId);
  const hostLifecycleGenerationRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<RemoteEditSessionInfo[]>([]);
  const [stoppingSessionIds, setStoppingSessionIds] = useState<Set<string>>(new Set());
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [stopErrorMessage, setStopErrorMessage] = useState('');

  const loadSessions = useCallback(async () => {
    const requestedHostId = hostId;
    const requestGeneration = ++requestGenerationRef.current;
    setIsLoading(true);
    setLoadErrorMessage('');
    try {
      const nextSessions = await listRemoteEditSessions(requestedHostId);
      if (
        currentHostIdRef.current === requestedHostId &&
        requestGenerationRef.current === requestGeneration
      ) {
        setSessions(nextSessions);
      }
    } catch (error) {
      if (
        currentHostIdRef.current === requestedHostId &&
        requestGenerationRef.current === requestGeneration
      ) {
        setLoadErrorMessage(formatAppError(error));
      }
    } finally {
      if (
        currentHostIdRef.current === requestedHostId &&
        requestGenerationRef.current === requestGeneration
      ) {
        setIsLoading(false);
      }
    }
  }, [hostId]);

  useLayoutEffect(() => {
    if (previousHostIdRef.current !== hostId) {
      hostLifecycleGenerationRef.current += 1;
      requestGenerationRef.current += 1;
      setSessions([]);
      setStoppingSessionIds(new Set());
      setLoadErrorMessage('');
      setStopErrorMessage('');
      setIsLoading(false);
      previousHostIdRef.current = hostId;
    }
    currentHostIdRef.current = hostId;
  }, [hostId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions, refreshKey]);

  const handleStop = async (session: RemoteEditSessionInfo) => {
    const { editSessionId, fileName } = session;
    const stoppedHostId = hostId;
    const stoppedHostGeneration = hostLifecycleGenerationRef.current;
    const isCurrentHostLifecycle = () =>
      currentHostIdRef.current === stoppedHostId &&
      hostLifecycleGenerationRef.current === stoppedHostGeneration;
    setStoppingSessionIds((current) => new Set(current).add(editSessionId));
    setStopErrorMessage('');
    try {
      await stopRemoteEdit(editSessionId);
      if (isCurrentHostLifecycle()) {
        requestGenerationRef.current += 1;
        setIsLoading(false);
        setSessions((current) => current.filter((item) => item.editSessionId !== editSessionId));
      }
    } catch (error) {
      if (isCurrentHostLifecycle()) {
        setStopErrorMessage(
          t('editor.stopSessionFailed', { name: fileName, error: formatAppError(error) }),
        );
      }
    } finally {
      if (isCurrentHostLifecycle()) {
        setStoppingSessionIds((current) => {
          const next = new Set(current);
          next.delete(editSessionId);
          return next;
        });
      }
    }
  };

  return (
    <div className="remote-edit-sessions" ref={anchorRef}>
      <button
        className="icon-button remote-edit-session-trigger"
        type="button"
        title={t('editor.activeSessions')}
        aria-label={t('editor.activeSessions')}
        aria-expanded={isOpen}
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) void loadSessions();
        }}
      >
        <FilePenLine />
        {sessions.length > 0 && <span className="remote-edit-count">{sessions.length}</span>}
      </button>
      {isOpen && (
        <AnchoredPortal
          anchorRef={anchorRef}
          className="remote-edit-session-menu"
          onClose={() => setIsOpen(false)}
        >
          <div className="remote-edit-menu-heading">
            <span>{t('editor.activeSessions')}</span>
            <small>{t('editor.sessionCount', { count: sessions.length })}</small>
          </div>
          {isLoading ? (
            <div className="remote-edit-menu-state">
              <LoaderCircle className="is-spinning" />
              <span>{t('editor.loadingSessions')}</span>
            </div>
          ) : loadErrorMessage && sessions.length === 0 ? (
            <div className="remote-edit-menu-state remote-edit-menu-state--error">
              {t('editor.sessionsFailed', { error: loadErrorMessage })}
            </div>
          ) : sessions.length === 0 ? (
            <div className="remote-edit-menu-state">{t('editor.noActiveSessions')}</div>
          ) : (
            <>
              <div className="remote-edit-session-list" role="list">
                {sessions.map((session) => {
                  const isStopping = stoppingSessionIds.has(session.editSessionId);
                  const stopLabel = t('editor.stopSession', { name: session.fileName });
                  return (
                    <div
                      className="remote-edit-session-item"
                      key={session.editSessionId}
                      role="listitem"
                    >
                      <button
                        className="remote-edit-session-open"
                        type="button"
                        title={session.remotePath}
                        disabled={isStopping}
                        onClick={() => {
                          if (isStopping) return;
                          setIsOpen(false);
                          void onOpen(session);
                        }}
                      >
                        <FilePenLine />
                        <span>
                          <strong>{session.fileName}</strong>
                          <small>{session.remotePath}</small>
                        </span>
                        <ExternalLink />
                      </button>
                      <button
                        className="remote-edit-session-stop"
                        type="button"
                        title={stopLabel}
                        aria-label={stopLabel}
                        disabled={isStopping}
                        onClick={() => void handleStop(session)}
                      >
                        {isStopping ? <LoaderCircle className="is-spinning" /> : <X />}
                      </button>
                    </div>
                  );
                })}
              </div>
              {stopErrorMessage && (
                <div className="remote-edit-menu-inline-error" role="alert">
                  {stopErrorMessage}
                </div>
              )}
            </>
          )}
        </AnchoredPortal>
      )}
    </div>
  );
}
