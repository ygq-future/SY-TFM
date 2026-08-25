import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LanguageDescription, type LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { Check, FileCode2, LoaderCircle, Maximize2, Minimize2, Minus, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ModalPortal } from '../../components/shared/ModalPortal';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatAppError } from '../../lib/errors';
import { readRemoteTextSnapshot } from '../../lib/tauri';
import type { RemoteTextSnapshot } from '../../types/generated/RemoteTextSnapshot';
import {
  classifyRemoteChange,
  getRemoteConflictSnapshot,
  type RemoteChangeDisposition,
} from './editorSync';

type LoadedLanguage = LanguageSupport;

interface OnlineEditorProps {
  hostId: string;
  fileName: string;
  remotePath: string;
  initialContent: string;
  initialRevision: string;
  windowed?: boolean;
  onSave: (content: string, expectedRevision: string) => Promise<RemoteTextSnapshot>;
  onClose: () => void;
}

interface RemoteConflict {
  snapshot: RemoteTextSnapshot;
  acknowledged: boolean;
}

/** 可嵌入移动端、也可运行在独立桌面窗口中的文本编辑器。 */
export function OnlineEditor({
  hostId,
  fileName,
  remotePath,
  initialContent,
  initialRevision,
  windowed = false,
  onSave,
  onClose,
}: OnlineEditorProps) {
  const { t } = useTranslation();
  const theme = useSettingsStore((state) => state.theme);
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [, setRevision] = useState(initialRevision);
  const [language, setLanguage] = useState<LoadedLanguage | null>(null);
  const [languageName, setLanguageName] = useState(t('editor.plainText'));
  const [isSaving, setIsSaving] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);
  const [remoteCheckError, setRemoteCheckError] = useState<string | null>(null);
  const [remoteConflict, setRemoteConflict] = useState<RemoteConflict | null>(null);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const isDirty = content !== savedContent;
  const isBlockedByConflict = Boolean(remoteConflict && !remoteConflict.acknowledged);
  const contentRef = useRef(content);
  const savedContentRef = useRef(savedContent);
  const revisionRef = useRef(initialRevision);
  const savingRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const conflictRevisionRef = useRef<string | null>(null);

  const setEditorContent = useCallback((nextContent: string) => {
    contentRef.current = nextContent;
    setContent(nextContent);
  }, []);

  useEffect(() => {
    let active = true;
    const description = LanguageDescription.matchFilename(languages, fileName);
    if (!description) {
      setLanguage(null);
      setLanguageName(t('editor.plainText'));
      return () => {
        active = false;
      };
    }
    setLanguageName(description.name);
    void description.load().then((support) => {
      if (active) setLanguage(support);
    });
    return () => {
      active = false;
    };
  }, [fileName, t]);

  const applyRemoteSnapshot = useCallback((snapshot: RemoteTextSnapshot) => {
    contentRef.current = snapshot.content;
    savedContentRef.current = snapshot.content;
    revisionRef.current = snapshot.revision;
    setContent(snapshot.content);
    setSavedContent(snapshot.content);
    setRevision(snapshot.revision);
    setRemoteConflict(null);
    conflictRevisionRef.current = null;
  }, []);

  const checkRemoteSnapshot = useCallback(async () => {
    if (savingRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    const revisionAtRequestStart = revisionRef.current;
    try {
      const snapshot = await readRemoteTextSnapshot(hostId, remotePath);
      setRemoteCheckError(null);
      if (revisionRef.current !== revisionAtRequestStart) return;
      const disposition: RemoteChangeDisposition = classifyRemoteChange(
        contentRef.current,
        savedContentRef.current,
        revisionRef.current,
        snapshot,
      );
      if (disposition === 'unchanged') return;
      if (disposition === 'reload') {
        applyRemoteSnapshot(snapshot);
        setRemoteNotice(t('editor.remoteReloaded'));
        return;
      }
      if (conflictRevisionRef.current === snapshot.revision) return;
      conflictRevisionRef.current = snapshot.revision;
      setRemoteConflict({ snapshot, acknowledged: false });
      setRemoteNotice(null);
    } catch (checkError) {
      setRemoteCheckError(formatAppError(checkError));
    } finally {
      pollInFlightRef.current = false;
    }
  }, [applyRemoteSnapshot, hostId, remotePath, t]);

  useEffect(() => {
    let active = true;
    const timer = window.setInterval(() => {
      if (active) void checkRemoteSnapshot();
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [checkRemoteSnapshot]);

  const save = useCallback(async () => {
    if (isSaving || !isDirty || isBlockedByConflict) return;
    const contentBeingSaved = contentRef.current;
    const expectedRevision = remoteConflict?.snapshot.revision ?? revisionRef.current;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const snapshot = await onSave(contentBeingSaved, expectedRevision);
      savedContentRef.current = contentBeingSaved;
      revisionRef.current = snapshot.revision;
      setSavedContent(contentBeingSaved);
      setRevision(snapshot.revision);
      setRemoteConflict(null);
      conflictRevisionRef.current = null;
      setRemoteNotice(null);
      setLastSynced(new Date().toLocaleTimeString([], { hour12: false }));
    } catch (saveError) {
      const conflictSnapshot = getRemoteConflictSnapshot(saveError);
      if (conflictSnapshot) {
        revisionRef.current = conflictSnapshot.revision;
        setRevision(conflictSnapshot.revision);
        conflictRevisionRef.current = conflictSnapshot.revision;
        setRemoteConflict({ snapshot: conflictSnapshot, acknowledged: false });
        setError(t('editor.remoteConflictDetected'));
      } else {
        setError(formatAppError(saveError));
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [isBlockedByConflict, isDirty, isSaving, onSave, remoteConflict, t]);

  const keepLocalChanges = useCallback(() => {
    setRemoteConflict((current) => {
      if (!current) return current;
      revisionRef.current = current.snapshot.revision;
      setRevision(current.snapshot.revision);
      return { ...current, acknowledged: true };
    });
    setError(null);
  }, []);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [requestClose, save]);

  useEffect(() => {
    if (!windowed) return;
    let disposed = false;
    let stopListening: (() => void) | undefined;
    const appWindow = getCurrentWindow();
    const syncMaximizedState = async () => {
      const maximized = await appWindow.isMaximized();
      if (!disposed) setIsWindowMaximized(maximized);
    };

    void syncMaximizedState().catch(() => undefined);
    void appWindow
      .onResized(() => void syncMaximizedState().catch(() => undefined))
      .then((unlisten) => {
        if (disposed) unlisten();
        else stopListening = unlisten;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [windowed]);

  const handleWindowDrag = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!windowed || event.button !== 0) return;
      void getCurrentWindow()
        .startDragging()
        .catch(() => undefined);
    },
    [windowed],
  );

  const toggleWindowMaximize = useCallback(() => {
    if (!windowed) return;
    const appWindow = getCurrentWindow();
    void appWindow
      .toggleMaximize()
      .then(() => appWindow.isMaximized())
      .then(setIsWindowMaximized)
      .catch(() => undefined);
  }, [windowed]);

  const minimizeWindow = useCallback(() => {
    if (!windowed) return;
    void getCurrentWindow()
      .minimize()
      .catch(() => undefined);
  }, [windowed]);

  const extensions = useMemo(
    () => (language ? [language, EditorView.lineWrapping] : [EditorView.lineWrapping]),
    [language],
  );

  const editor = (
    <div
      className={
        windowed
          ? 'online-editor-backdrop online-editor-backdrop--windowed'
          : 'online-editor-backdrop'
      }
      role="presentation"
    >
      <section
        className="online-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="online-editor-title"
      >
        <header
          className={
            windowed ? 'online-editor-header online-editor-windowbar' : 'online-editor-header'
          }
        >
          <div className="online-editor-identity">
            <span className="online-editor-file-icon" aria-hidden="true">
              <FileCode2 />
            </span>
            <div>
              <strong id="online-editor-title">{fileName}</strong>
              <span title={remotePath}>{remotePath}</span>
            </div>
          </div>
          {windowed && (
            <div
              className="online-editor-titlebar-drag-zone"
              onMouseDown={handleWindowDrag}
              onDoubleClick={toggleWindowMaximize}
              aria-hidden="true"
            />
          )}
          <div className="online-editor-actions">
            <span className="online-editor-language">{languageName}</span>
            <button
              className="online-editor-save"
              type="button"
              disabled={isSaving || !isDirty || isBlockedByConflict}
              onClick={() => void save()}
            >
              {isSaving ? <LoaderCircle className="is-spinning" /> : <Save />}
              {isSaving
                ? t('editor.saving')
                : remoteConflict?.acknowledged
                  ? t('editor.overwrite')
                  : t('editor.save')}
            </button>
            {windowed && (
              <div
                className="online-editor-window-controls"
                aria-label={t('titlebar.windowControls')}
              >
                <button
                  className="online-editor-window-control"
                  type="button"
                  title={t('titlebar.minimize')}
                  aria-label={t('titlebar.minimize')}
                  onClick={minimizeWindow}
                >
                  <Minus />
                </button>
                <button
                  className="online-editor-window-control"
                  type="button"
                  title={t(isWindowMaximized ? 'titlebar.restore' : 'titlebar.maximize')}
                  aria-label={t(isWindowMaximized ? 'titlebar.restore' : 'titlebar.maximize')}
                  onClick={toggleWindowMaximize}
                >
                  {isWindowMaximized ? <Minimize2 /> : <Maximize2 />}
                </button>
              </div>
            )}
            <button
              className="icon-button online-editor-close"
              type="button"
              title={t('common.close')}
              onClick={requestClose}
            >
              <X />
            </button>
          </div>
        </header>

        <div className="online-editor-conflict-slot">
          {remoteConflict && (
            <aside className="online-editor-conflict" role="alert">
              <div className="online-editor-conflict-copy">
                <strong>{t('editor.remoteConflictTitle')}</strong>
                <span>
                  {remoteConflict.acknowledged
                    ? t('editor.remoteConflictAcknowledged')
                    : t('editor.remoteConflictMessage')}
                </span>
              </div>
              {!remoteConflict.acknowledged && (
                <div className="online-editor-conflict-actions">
                  <button
                    type="button"
                    onClick={() => applyRemoteSnapshot(remoteConflict.snapshot)}
                  >
                    {t('editor.reloadRemote')}
                  </button>
                  <button type="button" onClick={keepLocalChanges}>
                    {t('editor.keepLocal')}
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>

        <div className="online-editor-body">
          <CodeMirror
            className="online-editor-codemirror"
            value={content}
            height="100%"
            theme={theme}
            extensions={extensions}
            onChange={setEditorContent}
            basicSetup={{
              autocompletion: false,
              closeBrackets: false,
              foldGutter: false,
              highlightActiveLineGutter: true,
            }}
          />
        </div>

        <footer className="online-editor-footer">
          <span className={isDirty ? 'editor-dirty-indicator is-dirty' : 'editor-dirty-indicator'}>
            <i />
            {isDirty ? t('editor.unsaved') : t('editor.saved')}
          </span>
          {remoteNotice ? (
            <span className="online-editor-remote-notice">{remoteNotice}</span>
          ) : error ? (
            <span className="online-editor-error">{error}</span>
          ) : remoteCheckError ? (
            <span className="online-editor-error">
              {t('editor.remoteCheckFailed', { error: remoteCheckError })}
            </span>
          ) : lastSynced ? (
            <span className="online-editor-synced">
              <Check /> {t('editor.syncedAt', { time: lastSynced })}
            </span>
          ) : (
            <span>{t('editor.saveShortcut')}</span>
          )}
        </footer>
      </section>
    </div>
  );

  return <ModalPortal>{editor}</ModalPortal>;
}
