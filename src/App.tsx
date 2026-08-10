import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { basename } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  CheckCircle2,
  Clipboard,
  Cloud,
  Download,
  Edit3,
  FileCode2,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Home,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DndContext,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';

import {
  getConnectionStatus,
  getStoragePaths,
  beginTransfer,
  finishTransfer,
  backgroundImageMimeType,
  loadBackgroundImage,
  loadBackgroundImageBytes,
  onConnectionStatus,
  onDownloadBatchProgress,
  onDownloadDone,
  onDownloadProgress,
  onUploadDone,
  onUploadProgress,
  onEditorError,
  onEditorSessionInvalid,
  onEditorSynced,
  readRemoteText,
  syncVaultNow,
  startRemoteEdit,
  uploadFile,
  uploadContent,
} from './lib/tauri';
import type { RemoteFile } from './types/generated/RemoteFile';
import type { RemoteEditSessionInfo } from './types/generated/RemoteEditSessionInfo';
import { useConnectionStore } from './stores/connectionStore';
import { createTransferOperationId, useBrowserStore, type PaneIndex } from './stores/browserStore';
import { flushSettingsWrites, useSettingsStore } from './stores/settingsStore';
import { useVaultSyncStore } from './stores/vaultSyncStore';
import { HostList } from './features/connection/HostList';
import { Breadcrumb } from './features/browser/Breadcrumb';
import {
  FileList,
  type DirectoryDropData,
  type FileDragData,
  type FileDropData,
} from './features/browser/FileList';
import { UploadZone } from './features/browser/UploadZone';
import { ContextMenu } from './features/browser/ContextMenu';
import { PaneHostSelect } from './features/browser/PaneHostSelect';
import { RemoteEditSessionsMenu } from './features/editor/RemoteEditSessionsMenu';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { AlertDialog, ConfirmDialog, InputDialog } from './components/shared/Dialog';
import { ToastProvider } from './components/shared/ToastProvider';
import { AppTitleBar } from './components/layout/AppTitleBar';
import { formatAppError } from './lib/errors';
import { pickDirectory } from './lib/dialog';
import {
  calculateTransferPercent,
  isEditableTextFile,
  joinRemotePath,
  normalizeRemotePath,
} from './features/browser/browserViewModel';
import { ModalPortal } from './components/shared/ModalPortal';
import i18n from './lib/i18n';
import { activateHostInPane, collapseToSinglePane, reconcilePaneHosts } from './lib/paneAssignment';
import { cn } from './lib/utils';
import { hasActiveAppOverlay } from './lib/overlayInteraction';
import {
  MOBILE_DIRECTORY_OVERLAP_THRESHOLD,
  MOBILE_FILE_DRAG_GAP,
  PlatformPointerSensor,
  mobileDrawerDragProgress,
  mobileDrawerTranslate,
  mobileFileDragRect,
  rectangleOverlapRatio,
  settleMobileDrawer,
} from './lib/dragSensors';

const OnlineEditor = lazy(async () => {
  const module = await import('./features/editor/OnlineEditor');
  return { default: module.OnlineEditor };
});

interface BrowserPageProps {
  paneIndex: PaneIndex;
  hostId: string;
  onHostChange: (hostId: string) => void;
}

/** 单个独立文件浏览面板。 */
function BrowserPage({ paneIndex, hostId, onHostChange }: BrowserPageProps) {
  const { t } = useTranslation();
  const browserPageRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [isNativeDragging, setIsNativeDragging] = useState(false);
  const [remoteEditRevision, setRemoteEditRevision] = useState(0);
  const pane = useBrowserStore((state) => state.panes[paneIndex]);
  const {
    activePane,
    initializeDirectory,
    navigateToPath,
    refresh,
    toggleSort,
    selectFiles,
    setCapabilities,
    setActivePane,
    startTransfer,
    updateTransfer,
    setOperationMessage,
    clearOperationMessage,
    downloadSelected,
    deleteSelected,
    renameFile,
    createDirectory,
    createFile,
  } = useBrowserStore();
  const { hostCapabilities, hosts } = useConnectionStore();
  const activeCapability = hostCapabilities[hostId] ?? null;
  const defaultDownloadPath = useSettingsStore((state) => state.defaultDownloadPath);
  const activeHost = hosts.find((host) => host.id === hostId) ?? null;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: RemoteFile | null;
  } | null>(null);
  const [onlineEditor, setOnlineEditor] = useState<{
    file: RemoteFile;
    content: string;
  } | null>(null);
  const editorOperationMessageRef = useRef<string | null>(null);
  const onlineEditorGenerationRef = useRef(0);
  const [unsupportedEditFile, setUnsupportedEditFile] = useState<RemoteFile | null>(null);
  const [dialog, setDialog] = useState<
    | { type: 'mkdir' }
    | { type: 'createFile' }
    | { type: 'rename'; file: RemoteFile }
    | { type: 'deleteConfirm' }
    | null
  >(null);

  const setEditorOperationMessage = useCallback(
    (message: string, isError = false) => {
      editorOperationMessageRef.current = message;
      setOperationMessage(message, isError);
    },
    [setOperationMessage],
  );

  const clearEditorOperationMessage = useCallback(() => {
    const message = editorOperationMessageRef.current;
    if (message) clearOperationMessage(message);
    editorOperationMessageRef.current = null;
  }, [clearOperationMessage]);

  useEffect(
    () => () => {
      onlineEditorGenerationRef.current += 1;
      const message = editorOperationMessageRef.current;
      if (message) useBrowserStore.getState().clearOperationMessage(message);
    },
    [],
  );

  useEffect(() => {
    setCapabilities(paneIndex, activeCapability);
  }, [activeCapability, paneIndex, setCapabilities]);

  useEffect(() => {
    void initializeDirectory(paneIndex, hostId);
  }, [hostId, initializeDirectory, paneIndex]);

  useEffect(() => {
    const handleFileShortcut = (event: KeyboardEvent) => {
      if (activePane !== paneIndex || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"], [role="dialog"], [role="alertdialog"], [role="menu"], .cm-editor',
        )
      ) {
        return;
      }
      const selectedFiles = pane.selectedFiles.filter((file) => file.name !== '..');
      if (event.key === 'Delete' && selectedFiles.length > 0) {
        event.preventDefault();
        setContextMenu(null);
        selectFiles(paneIndex, selectedFiles);
        setDialog({ type: 'deleteConfirm' });
      } else if (event.key === 'F2' && selectedFiles.length === 1) {
        event.preventDefault();
        setContextMenu(null);
        setDialog({ type: 'rename', file: selectedFiles[0] });
      }
    };
    window.addEventListener('keydown', handleFileShortcut);
    return () => window.removeEventListener('keydown', handleFileShortcut);
  }, [activePane, pane.selectedFiles, paneIndex, selectFiles]);

  const handleOpen = useCallback(
    (file: RemoteFile) => {
      if (file.isDirectory) void navigateToPath(paneIndex, hostId, file.fullPath);
    },
    [hostId, navigateToPath, paneIndex],
  );

  const handleContextMenu = useCallback((event: React.MouseEvent, file: RemoteFile | null) => {
    event.preventDefault();
    if (document.documentElement.classList.contains('mobile-platform')) return;
    setContextMenu({ x: event.clientX, y: event.clientY, file });
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      await downloadSelected(
        paneIndex,
        hostId,
        activeHost?.downloadPath ||
          defaultDownloadPath ||
          (await getStoragePaths()).defaultDownloadPath,
      );
    } catch {
      // 失败详情已写入全局状态栏。
    }
  }, [activeHost?.downloadPath, defaultDownloadPath, downloadSelected, hostId, paneIndex]);

  const handleDownloadTo = useCallback(async () => {
    try {
      const selectedDirectory = await pickDirectory(
        t('browser.chooseDownload'),
        activeHost?.downloadPath ?? undefined,
      );
      if (selectedDirectory) await downloadSelected(paneIndex, hostId, selectedDirectory);
    } catch (error) {
      setOperationMessage(t('browser.openDirectoryFailed', { error: formatAppError(error) }), true);
    }
  }, [activeHost?.downloadPath, downloadSelected, hostId, paneIndex, setOperationMessage, t]);

  const handleOnlineEdit = useCallback(
    async (file: RemoteFile) => {
      const editorGeneration = ++onlineEditorGenerationRef.current;
      setEditorOperationMessage(t('editor.opening', { name: file.name }));
      try {
        const content = await readRemoteText(hostId, file.fullPath);
        if (onlineEditorGenerationRef.current !== editorGeneration) return;
        setOnlineEditor({ file, content });
        setEditorOperationMessage(t('editor.openedOnline', { name: file.name }));
      } catch (error) {
        if (onlineEditorGenerationRef.current !== editorGeneration) return;
        setEditorOperationMessage(
          t('editor.openFailed', { name: file.name, error: formatAppError(error) }),
          true,
        );
      }
    },
    [hostId, setEditorOperationMessage, t],
  );

  const handleRemoteEdit = useCallback(
    async (file: RemoteFile) => {
      if (!isEditableTextFile(file.name)) {
        setUnsupportedEditFile(file);
        return;
      }
      setEditorOperationMessage(t('editor.opening', { name: file.name }));
      try {
        const remoteSession = await startRemoteEdit(hostId, file.fullPath, file.name);
        await openPath(remoteSession.localPath);
        setRemoteEditRevision((revision) => revision + 1);
        clearEditorOperationMessage();
      } catch (error) {
        setEditorOperationMessage(
          t('editor.openFailed', { name: file.name, error: formatAppError(error) }),
          true,
        );
      }
    },
    [clearEditorOperationMessage, hostId, setEditorOperationMessage, t],
  );

  const handleOpenRemoteSession = useCallback(
    async (session: RemoteEditSessionInfo) => {
      setEditorOperationMessage(t('editor.opening', { name: session.fileName }));
      try {
        await openPath(session.localPath);
        clearEditorOperationMessage();
      } catch (error) {
        setEditorOperationMessage(
          t('editor.openFailed', { name: session.fileName, error: formatAppError(error) }),
          true,
        );
      }
    },
    [clearEditorOperationMessage, setEditorOperationMessage, t],
  );

  const handleDelete = useCallback(async () => {
    try {
      await deleteSelected(paneIndex, hostId);
      setOperationMessage(t('browser.deleteDone'));
    } catch (error) {
      setOperationMessage(t('browser.deleteFailed', { error: formatAppError(error) }), true);
    }
  }, [deleteSelected, hostId, paneIndex, setOperationMessage, t]);

  const handlePickedFiles = useCallback(
    async (pickedFiles: File[]) => {
      if (pickedFiles.length === 0) return;
      const operationId = createTransferOperationId('localToRemote');
      startTransfer({
        operationId,
        hostId,
        isActive: true,
        isSuccessful: false,
        isCancelling: false,
        isCancelled: false,
        percent: 0,
        direction: 'localToRemote',
        message: t('browser.preparingUpload', { count: pickedFiles.length }),
        currentIndex: 0,
        totalCount: pickedFiles.length,
        speed: 0,
      });
      await beginTransfer(operationId, [hostId]);
      try {
        for (let index = 0; index < pickedFiles.length; index += 1) {
          const file = pickedFiles[index];
          updateTransfer(operationId, {
            currentIndex: index + 1,
            totalCount: pickedFiles.length,
            message: t('browser.uploading', {
              name: file.name,
              current: index + 1,
              total: pickedFiles.length,
            }),
          });
          const remotePath = joinRemotePath(pane.currentPath, file.name);
          await uploadContent(
            hostId,
            remotePath,
            new Uint8Array(await file.arrayBuffer()),
            operationId,
          );
        }
        await refresh(paneIndex, hostId);
        updateTransfer(operationId, {
          isActive: false,
          isSuccessful: true,
          isCancelled: false,
          percent: 100,
          message: t('browser.uploadDone'),
          currentIndex: pickedFiles.length,
          totalCount: pickedFiles.length,
          isCancelling: false,
        });
      } catch (error) {
        const cancelled = isOperationCancelled(error);
        updateTransfer(operationId, {
          isActive: false,
          isSuccessful: false,
          isCancelling: false,
          isCancelled: cancelled,
          message: cancelled
            ? t('transfer.cancelled')
            : t('browser.uploadFailed', { error: formatAppError(error) }),
        });
      } finally {
        await finishTransfer(operationId);
        if (uploadInputRef.current) uploadInputRef.current.value = '';
      }
    },
    [hostId, pane.currentPath, paneIndex, refresh, startTransfer, t, updateTransfer],
  );

  const handlePickedPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      const operationId = createTransferOperationId('localToRemote');
      startTransfer({
        operationId,
        hostId,
        isActive: true,
        isSuccessful: false,
        isCancelling: false,
        isCancelled: false,
        percent: 0,
        direction: 'localToRemote',
        message: t('browser.preparingUpload', { count: paths.length }),
        currentIndex: 0,
        totalCount: paths.length,
        speed: 0,
      });
      await beginTransfer(operationId, [hostId]);
      try {
        for (let index = 0; index < paths.length; index += 1) {
          const localPath = paths[index];
          const name = await basename(localPath);
          updateTransfer(operationId, {
            currentIndex: index + 1,
            totalCount: paths.length,
            message: t('browser.uploading', {
              name,
              current: index + 1,
              total: paths.length,
            }),
          });
          await uploadFile(hostId, localPath, joinRemotePath(pane.currentPath, name), operationId);
        }
        await refresh(paneIndex, hostId);
        updateTransfer(operationId, {
          isActive: false,
          isSuccessful: true,
          isCancelled: false,
          isCancelling: false,
          percent: 100,
          message: t('browser.uploadDone'),
          currentIndex: paths.length,
          totalCount: paths.length,
        });
      } catch (error) {
        const cancelled = isOperationCancelled(error);
        updateTransfer(operationId, {
          isActive: false,
          isSuccessful: false,
          isCancelling: false,
          isCancelled: cancelled,
          message: cancelled
            ? t('transfer.cancelled')
            : t('browser.uploadFailed', { error: formatAppError(error) }),
        });
      } finally {
        await finishTransfer(operationId);
      }
    },
    [hostId, pane.currentPath, paneIndex, refresh, startTransfer, t, updateTransfer],
  );

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const register = async () => {
      const scaleFactor = await getCurrentWindow().scaleFactor();
      unlisten = await getCurrentWindow().onDragDropEvent((event) => {
        if (!active) return;
        if (event.payload.type === 'leave') {
          setIsNativeDragging(false);
          return;
        }
        const rect = browserPageRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = event.payload.position.x / scaleFactor;
        const y = event.payload.position.y / scaleFactor;
        const isInside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        setIsNativeDragging(isInside);
        if (event.payload.type === 'drop' && isInside) {
          setIsNativeDragging(false);
          void handlePickedPaths(event.payload.paths);
        }
      });
    };
    void register();
    return () => {
      active = false;
      unlisten?.();
    };
  }, [handlePickedPaths]);

  const copyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(normalizeRemotePath(pane.currentPath));
      setOperationMessage(t('browser.pathCopied'));
    } catch {
      setOperationMessage(t('browser.copyFailed'), true);
    }
  }, [pane.currentPath, setOperationMessage, t]);
  const mobileSelectedFiles = pane.selectedFiles.filter((file) => file.name !== '..');
  const mobileActionFile = mobileSelectedFiles.length === 1 ? mobileSelectedFiles[0] : null;

  return (
    <div
      ref={browserPageRef}
      className="browser-page page-enter"
      onPointerDown={(event) => {
        setActivePane(paneIndex);
        const target = event.target;
        if (
          event.button === 0 &&
          target instanceof Element &&
          !target.closest('[data-file-index], button, input, textarea, [role="menu"]')
        ) {
          selectFiles(paneIndex, []);
        }
      }}
      onContextMenu={(event) => handleContextMenu(event, null)}
    >
      <section className="browser-toolbar" aria-label={t('browser.toolbar')}>
        <div className="path-cluster">
          <PaneHostSelect hostId={hostId} onChange={onHostChange} />
          <Breadcrumb
            path={pane.currentPath}
            isEditing={isEditingPath}
            onEditingChange={setIsEditingPath}
            onNavigate={(path) => void navigateToPath(paneIndex, hostId, path)}
          />
        </div>
        <div className="path-actions">
          <button
            className="icon-button"
            type="button"
            title={t('browser.home')}
            disabled={pane.isLoading}
            onClick={() => void navigateToPath(paneIndex, hostId, pane.homePath)}
          >
            <Home />
          </button>
          <button
            className="icon-button path-edit-action"
            type="button"
            title={t('browser.editPath')}
            onClick={() => setIsEditingPath(true)}
          >
            <Edit3 />
          </button>
          <button
            className="icon-button"
            type="button"
            title={t('browser.copyPath')}
            onClick={() => void copyPath()}
          >
            <Clipboard />
          </button>
          <span className="path-action-separator" />
          <button
            className="icon-button"
            type="button"
            title={t('browser.refresh')}
            onClick={() => void refresh(paneIndex, hostId)}
          >
            <RefreshCw className={pane.isLoading ? 'is-spinning' : ''} />
          </button>
          <button
            className="icon-button"
            type="button"
            title={t('browser.upload')}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload />
          </button>
          <button
            className="icon-button"
            type="button"
            title={t('browser.download')}
            disabled={pane.selectedFiles.length === 0}
            onClick={() => void handleDownload()}
          >
            <Download />
          </button>
          <RemoteEditSessionsMenu
            hostId={hostId}
            refreshKey={remoteEditRevision}
            onOpen={handleOpenRemoteSession}
          />
          <input
            ref={uploadInputRef}
            className="hidden"
            type="file"
            multiple
            onChange={(event) => void handlePickedFiles(Array.from(event.target.files ?? []))}
          />
        </div>
        <div
          className="mobile-file-actions"
          aria-label={t('browser.selectionActions')}
          data-drawer-gesture="exclude"
        >
          <button
            className="mobile-file-action mobile-refresh-action"
            type="button"
            disabled={pane.isLoading}
            onClick={() => void refresh(paneIndex, hostId)}
          >
            <RefreshCw className={pane.isLoading ? 'is-spinning' : ''} />
            <span>{t('browser.refresh')}</span>
          </button>
          <button
            className="mobile-file-action mobile-upload-action"
            type="button"
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload />
            <span>{t('browser.upload')}</span>
          </button>
          <button
            className="mobile-file-action"
            type="button"
            disabled={mobileSelectedFiles.length === 0}
            onClick={() => void handleDownload()}
          >
            <Download />
            <span>{t('browser.download')}</span>
          </button>
          <button
            className="mobile-file-action"
            type="button"
            disabled={!mobileActionFile}
            onClick={() =>
              mobileActionFile && setDialog({ type: 'rename', file: mobileActionFile })
            }
          >
            <Edit3 />
            <span>{t('browser.rename')}</span>
          </button>
          <button
            className="mobile-file-action mobile-file-action--danger"
            type="button"
            disabled={pane.selectedFiles.length === 0}
            onClick={() => setDialog({ type: 'deleteConfirm' })}
          >
            <Trash2 />
            <span>{t('common.delete')}</span>
          </button>
          <button
            className="mobile-file-action"
            type="button"
            onClick={() => setDialog({ type: 'createFile' })}
          >
            <FilePlus2 />
            <span>{t('browser.newFile')}</span>
          </button>
          <button
            className="mobile-file-action"
            type="button"
            onClick={() => setDialog({ type: 'mkdir' })}
          >
            <FolderPlus />
            <span>{t('browser.newFolder')}</span>
          </button>
          <button
            className="mobile-file-action"
            type="button"
            disabled={!mobileActionFile || mobileActionFile.isDirectory}
            onClick={() => mobileActionFile && void handleOnlineEdit(mobileActionFile)}
          >
            <FileCode2 />
            <span>{t('contextMenu.onlineEdit')}</span>
          </button>
        </div>
      </section>

      <section className="file-workspace" aria-label={t('browser.remoteFiles')}>
        <div className="file-list-stage">
          {pane.isLoading && pane.files.length === 0 ? (
            <div className="browser-state">
              <LoaderCircle className="is-spinning" />
              <strong>{t('browser.loadingTitle')}</strong>
              <span>{t('browser.loadingHint')}</span>
            </div>
          ) : pane.files.length === 0 ? (
            <div className="browser-state">
              <FolderOpen />
              <strong>{t('browser.emptyTitle')}</strong>
              <span>{t('browser.emptyHint')}</span>
            </div>
          ) : (
            <FileList
              files={pane.files}
              capabilities={pane.capabilities}
              onOpen={handleOpen}
              onSelect={(files) => selectFiles(paneIndex, files)}
              selectedFiles={pane.selectedFiles}
              onSort={(column) => toggleSort(paneIndex, column)}
              sortColumn={pane.sortColumn}
              sortOrder={pane.sortOrder}
              onContextMenu={handleContextMenu}
              paneIndex={paneIndex}
              hostId={hostId}
              currentPath={pane.currentPath}
            />
          )}
          <UploadZone
            isNativeDragging={isNativeDragging}
            onFilesDropped={(files) => void handlePickedFiles(files)}
          />
        </div>
      </section>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          selectionCount={pane.selectedFiles.length}
          onClose={() => setContextMenu(null)}
          onMkdir={() => setDialog({ type: 'mkdir' })}
          onCreateFile={() => setDialog({ type: 'createFile' })}
          onRename={() => contextMenu.file && setDialog({ type: 'rename', file: contextMenu.file })}
          onDelete={() => setDialog({ type: 'deleteConfirm' })}
          onDownload={() => void handleDownload()}
          onDownloadTo={() => void handleDownloadTo()}
          onRefresh={() => void refresh(paneIndex, hostId)}
          onRemoteEdit={() => contextMenu.file && void handleRemoteEdit(contextMenu.file)}
          onOnlineEdit={() => contextMenu.file && void handleOnlineEdit(contextMenu.file)}
        />
      )}

      {onlineEditor && (
        <Suspense fallback={null}>
          <OnlineEditor
            fileName={onlineEditor.file.name}
            remotePath={onlineEditor.file.fullPath}
            initialContent={onlineEditor.content}
            onClose={() => {
              onlineEditorGenerationRef.current += 1;
              setOnlineEditor(null);
              clearEditorOperationMessage();
            }}
            onSave={async (content) => {
              const editorGeneration = onlineEditorGenerationRef.current;
              const operationId = createTransferOperationId('localToRemote');
              setEditorOperationMessage(t('editor.syncing', { name: onlineEditor.file.name }));
              try {
                await beginTransfer(operationId, [hostId]);
                await uploadContent(hostId, onlineEditor.file.fullPath, content, operationId);
                const syncTime = new Date().toLocaleTimeString([], { hour12: false });
                if (onlineEditorGenerationRef.current === editorGeneration) {
                  setEditorOperationMessage(
                    t('editor.synced', { name: onlineEditor.file.name, time: syncTime }),
                  );
                }
                await refresh(paneIndex, hostId);
                return syncTime;
              } catch (error) {
                if (onlineEditorGenerationRef.current === editorGeneration) {
                  setEditorOperationMessage(
                    t('editor.syncFailed', {
                      name: onlineEditor.file.name,
                      error: formatAppError(error),
                    }),
                    true,
                  );
                }
                throw error;
              } finally {
                await finishTransfer(operationId);
              }
            }}
          />
        </Suspense>
      )}

      {dialog?.type === 'mkdir' && (
        <InputDialog
          title={t('browser.newFolder')}
          label={t('browser.folderName')}
          confirmLabel={t('common.create')}
          onConfirm={async (name) => {
            setDialog(null);
            try {
              await createDirectory(paneIndex, hostId, name);
              setOperationMessage(t('browser.folderCreated'));
            } catch (error) {
              setOperationMessage(
                t('browser.createFailed', { error: formatAppError(error) }),
                true,
              );
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'createFile' && (
        <InputDialog
          title={t('browser.newFile')}
          label={t('browser.fileName')}
          confirmLabel={t('common.create')}
          onConfirm={async (name) => {
            setDialog(null);
            try {
              await createFile(paneIndex, hostId, name);
              setOperationMessage(t('browser.fileCreated'));
            } catch (error) {
              setOperationMessage(
                t('browser.createFailed', { error: formatAppError(error) }),
                true,
              );
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'rename' && (
        <InputDialog
          title={t('browser.rename')}
          label={t('browser.newName')}
          defaultValue={dialog.file.name}
          confirmLabel={t('browser.rename')}
          onConfirm={async (name) => {
            const file = dialog.file;
            setDialog(null);
            try {
              await renameFile(paneIndex, hostId, file, name);
              setOperationMessage(t('browser.renameDone'));
            } catch (error) {
              setOperationMessage(
                t('browser.renameFailed', { error: formatAppError(error) }),
                true,
              );
            }
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'deleteConfirm' && (
        <ConfirmDialog
          title={t('browser.deleteTitle')}
          message={t('browser.deleteMessage', { count: pane.selectedFiles.length })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => {
            setDialog(null);
            void handleDelete();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {unsupportedEditFile && (
        <AlertDialog
          title={t('editor.unsupportedTitle')}
          message={t('editor.unsupportedMessage', { name: unsupportedEditFile.name })}
          onClose={() => setUnsupportedEditFile(null)}
        />
      )}
    </div>
  );
}

function WorkspaceLanding({ onOpen }: { onOpen: (hostId: string) => void }) {
  const { t } = useTranslation();
  const { hosts, selectedHostId, connectedHostIds } = useConnectionStore();
  const isMobilePlatform =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('mobile-platform');
  const selectedHost = hosts.find((host) => host.id === selectedHostId) ?? null;
  const isConnected = selectedHost ? connectedHostIds.includes(selectedHost.id) : false;

  return (
    <div
      className={
        selectedHost
          ? 'workspace-pane workspace-pane--empty'
          : 'workspace-pane workspace-pane--empty workspace-pane--welcome'
      }
    >
      <div className="pane-path-bar">
        {isMobilePlatform ? (
          <span className="pane-index">{selectedHost?.name ?? t('browser.noHost')}</span>
        ) : (
          <PaneHostSelect hostId={selectedHostId ?? ''} onChange={onOpen} />
        )}
        <Breadcrumb
          path="/"
          isEditing={false}
          onEditingChange={() => undefined}
          onNavigate={() => undefined}
        />
      </div>
      <div className="workspace-landing">
        <div className="workspace-landing-icon">
          <Cloud />
        </div>
        {selectedHost ? (
          <>
            <h1>{selectedHost.name}</h1>
            <p>
              {selectedHost.username}@{selectedHost.host}:{selectedHost.port}
            </p>
            <span
              className={isConnected ? 'landing-status landing-status--online' : 'landing-status'}
            >
              <span className={isConnected ? 'status-dot status-dot--active' : 'status-dot'} />
              {isConnected ? t('browser.connected') : t('browser.connectHint')}
            </span>
            {isConnected && (
              <button
                className="primary-button"
                type="button"
                onClick={() => onOpen(selectedHost.id)}
              >
                {t('browser.openFiles')}
              </button>
            )}
          </>
        ) : (
          <>
            <h1>{t('browser.selectHostTitle')}</h1>
            <p>{t('browser.selectHostHint')}</p>
          </>
        )}
      </div>
    </div>
  );
}

function GlobalStatusBar() {
  const { t } = useTranslation();
  const { hosts, connectedHostIds, connectionStatus, error } = useConnectionStore();
  const { panes, activePane, transfers, operationMessage, operationIsError, cancelTransfer } =
    useBrowserStore();
  const { status: vaultStatus, refreshStatus: refreshVaultStatus } = useVaultSyncStore();
  useEffect(() => {
    void refreshVaultStatus();
    const refresh = () => void refreshVaultStatus();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refreshVaultStatus]);
  const transferList = Object.values(transfers);
  const pane = panes[activePane];
  const isPaneConnected = pane.hostId !== null && connectedHostIds.includes(pane.hostId);
  const paneError = isPaneConnected ? pane.errorMessage : '';
  const busyConnection = Object.entries(connectionStatus).find(
    ([, status]) => status === 'connecting' || status === 'reconnecting',
  );
  const busyHost = busyConnection ? hosts.find((host) => host.id === busyConnection[0]) : undefined;
  const connectionMessage = busyConnection
    ? t(
        busyConnection[1] === 'reconnecting'
          ? 'browser.reconnectingHost'
          : 'browser.connectingHost',
        { name: busyHost?.name ?? busyConnection[0] },
      )
    : null;
  const statusText =
    error ||
    connectionMessage ||
    paneError ||
    operationMessage ||
    (isPaneConnected && pane.isLoading
      ? t('browser.readingRemote')
      : connectedHostIds.length > 0
        ? t('browser.activeConnections', { count: connectedHostIds.length })
        : t('browser.ready'));
  const isError = Boolean(
    error ||
    paneError ||
    operationIsError ||
    transferList.some(
      (transfer) =>
        !transfer.isCancelled &&
        !transfer.isSuccessful &&
        !transfer.isActive &&
        Boolean(transfer.message),
    ),
  );

  return (
    <footer className="global-status-bar">
      <div className={isError ? 'global-status global-status--error' : 'global-status'}>
        {busyConnection ? (
          <span className="status-loading-spinner" aria-hidden="true" />
        ) : (
          <span
            className={connectedHostIds.length > 0 ? 'status-dot status-dot--active' : 'status-dot'}
          />
        )}
        <span>{statusText}</span>
      </div>
      <div
        className={
          transferList.length > 0 ? 'transfer-status transfer-status--visible' : 'transfer-status'
        }
      >
        {transferList.map((transfer) => (
          <div className="transfer-task" key={transfer.operationId}>
            {transfer.isSuccessful && !transfer.isActive && <CheckCircle2 />}
            {transfer.isActive && !transfer.isCancelling && (
              <span className="transfer-spinner" aria-hidden="true" />
            )}
            <span className="transfer-task-message">{transfer.message}</span>
            {transfer.totalCount > 0 && (
              <span className="transfer-count">
                {Math.min(transfer.currentIndex, transfer.totalCount)} / {transfer.totalCount}
              </span>
            )}
            {transfer.speed > 0 && (
              <span className="transfer-speed">{formatTransferSpeed(transfer.speed)}</span>
            )}
            <div className="status-progress-track">
              <span style={{ width: `${transfer.percent}%` }} />
            </div>
            <strong>{Math.round(transfer.percent)}%</strong>
            {transfer.isActive && (
              <button
                className="transfer-cancel"
                type="button"
                title={t('transfer.cancel')}
                disabled={transfer.isCancelling}
                onClick={() => void cancelTransfer(transfer.operationId)}
              >
                {transfer.isCancelling ? (
                  <span className="transfer-cancel-spinner" aria-hidden="true" />
                ) : (
                  <X />
                )}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="status-meta">
        {vaultStatus?.configured && (
          <span className="vault-status-meta">
            <Cloud />
            <span>
              {t(
                vaultStatus.enabled
                  ? 'settings.storage.vaultStatusActive'
                  : vaultStatus.vaultInitialized
                    ? 'settings.storage.vaultStatusPaused'
                    : 'settings.storage.vaultStatusSaved',
              )}
            </span>
            <i aria-hidden="true" />
            <time>
              {vaultStatus.lastSyncedAt
                ? new Date(vaultStatus.lastSyncedAt).toLocaleString()
                : t('settings.storage.vaultNever')}
            </time>
          </span>
        )}
        {isPaneConnected && (
          <span className="status-file-count">
            {pane.selectedFiles.length > 0
              ? t('browser.selectedCount', { count: pane.selectedFiles.length })
              : t('browser.itemCount', {
                  count: pane.files.filter((file) => file.name !== '..').length,
                })}
          </span>
        )}
      </div>
    </footer>
  );
}

function formatTransferSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let value = bytesPerSecond;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 100 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function isOperationCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'operation_cancelled'
  );
}

/** Android 应保留可编辑控件的原生选择、复制和剪切菜单。 */
function isNativeTextContextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, [contenteditable="true"], [role="textbox"]'))
  );
}

/** 将触摸拖动提示放在触点左上方，避免被手指遮挡。 */
function fileDragOverlayTransform(x: number, y: number): string {
  if (!document.documentElement.classList.contains('mobile-platform')) {
    return `translate3d(${x + 12}px, ${y + 12}px, 0)`;
  }
  return `translate3d(${x}px, ${y}px, 0) translate3d(calc(-100% - ${MOBILE_FILE_DRAG_GAP}px), calc(-100% - ${MOBILE_FILE_DRAG_GAP}px), 0)`;
}

function AppInner() {
  const { t } = useTranslation();
  const [paneHostIds, setPaneHostIds] = useState<[string | null, string | null]>([null, null]);
  const [isDualPane, setIsDualPane] = useState(false);
  const [isHostPanelVisible, setIsHostPanelVisible] = useState(true);
  const [isMobileHostDrawerOpen, setIsMobileHostDrawerOpen] = useState(false);
  const [isMobileHostDrawerDragging, setIsMobileHostDrawerDragging] = useState(false);
  const [isMobileHostDrawerSettling, setIsMobileHostDrawerSettling] = useState(false);
  const mobileHostDrawerRef = useRef<HTMLDivElement>(null);
  const mobileHostDrawerProgressRef = useRef(0);
  const mobileHostDrawerFrameRef = useRef<number | null>(null);
  const mobileHostDrawerSettleTimerRef = useRef<number | null>(null);
  const mobileDrawerGestureRef = useRef<{
    startX: number;
    startY: number;
    width: number;
    initiallyOpen: boolean;
    horizontal: boolean;
  } | null>(null);
  const mobileDrawerGestureConsumedRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<FileDragData | null>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    source: FileDragData;
    target: DirectoryDropData;
    files: RemoteFile[];
  } | null>(null);
  const [backgroundImageSource, setBackgroundImageSource] = useState<string | null>(null);
  const startupVaultSyncHandledRef = useRef(false);
  const vaultStatus = useVaultSyncStore((state) => state.status);
  const {
    hosts,
    connectedHostIds,
    connectHost: reconnectHost,
    setConnectionStatus,
  } = useConnectionStore();
  const {
    panes,
    activePane,
    setActivePane,
    refresh,
    updateTransfer,
    setOperationMessage,
    clearOperationMessage,
    clearDisconnectedPanes,
    moveFiles,
    transferFiles,
  } = useBrowserStore();
  const dragSensors = useSensors(
    useSensor(PlatformPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 320, tolerance: 8 } }),
  );

  const reconcileVaultState = useCallback(async () => {
    await flushSettingsWrites();
    if (useVaultSyncStore.getState().status?.enabled === false) return;
    try {
      const nextStatus = await syncVaultNow();
      useVaultSyncStore.getState().setStatus(nextStatus);
      await Promise.all([
        useSettingsStore.getState().hydrateSettings(),
        useConnectionStore.getState().refreshHosts(),
      ]);
    } catch {
      await useVaultSyncStore.getState().refreshStatus();
    }
  }, []);

  useEffect(() => {
    if (startupVaultSyncHandledRef.current || vaultStatus === null) return;
    startupVaultSyncHandledRef.current = true;
    if (vaultStatus.enabled) void reconcileVaultState();
  }, [reconcileVaultState, vaultStatus]);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
    void reconcileVaultState();
  }, [reconcileVaultState]);

  useEffect(() => {
    if (isSettingsOpen || !vaultStatus?.enabled || !vaultStatus.refreshIntervalMs) return;
    const timer = window.setInterval(() => {
      void reconcileVaultState();
    }, vaultStatus.refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [isSettingsOpen, reconcileVaultState, vaultStatus?.enabled, vaultStatus?.refreshIntervalMs]);

  useEffect(() => {
    const syncBeforeBackground = () => {
      if (document.visibilityState === 'hidden') void reconcileVaultState();
    };
    document.addEventListener('visibilitychange', syncBeforeBackground);
    return () => document.removeEventListener('visibilitychange', syncBeforeBackground);
  }, [reconcileVaultState]);
  const dragCollisionDetection = useCallback<CollisionDetection>((args) => {
    if (document.documentElement.classList.contains('mobile-platform') && args.pointerCoordinates) {
      const previewRect = mobileFileDragRect(
        args.pointerCoordinates,
        dragOverlayRef.current?.offsetWidth ?? 0,
        dragOverlayRef.current?.offsetHeight ?? 0,
      );
      const collisions = rectIntersection({
        ...args,
        collisionRect: previewRect,
      });
      const paneCollision = collisions.find(
        (collision) => collision.data?.droppableContainer.data.current?.kind === 'pane',
      );
      if (!paneCollision) return [];
      const paneData = paneCollision.data?.droppableContainer.data.current as
        FileDropData | undefined;
      if (paneData?.kind !== 'pane') return [];
      const directoryCollision = collisions.find((collision) => {
        const data = collision.data?.droppableContainer.data.current as FileDropData | undefined;
        const directoryRect = args.droppableRects.get(collision.id);
        return (
          data?.kind === 'directory' &&
          data.paneIndex === paneData.paneIndex &&
          directoryRect !== undefined &&
          rectangleOverlapRatio(previewRect, directoryRect) > MOBILE_DIRECTORY_OVERLAP_THRESHOLD
        );
      });
      return directoryCollision ? [directoryCollision, paneCollision] : [paneCollision];
    }
    return pointerWithin(args).sort((left, right) => {
      const rank = (id: string | number) => {
        const value = String(id);
        if (value.startsWith('directory:')) return 2;
        if (value.startsWith('blocked:')) return 1;
        return 0;
      };
      return rank(right.id) - rank(left.id);
    });
  }, []);

  useEffect(() => {
    const handleSelectAll = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== 'a') return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"], [role="dialog"], [role="alertdialog"], .cm-editor',
        )
      ) {
        return;
      }
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      const state = useBrowserStore.getState();
      state.selectFiles(
        state.activePane,
        state.panes[state.activePane].files.filter((file) => file.name !== '..'),
      );
    };
    window.addEventListener('keydown', handleSelectAll);
    return () => window.removeEventListener('keydown', handleSelectAll);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as FileDragData | undefined;
    setActiveDrag(data?.kind === 'file' ? data : null);
    const activator = event.activatorEvent;
    const touch = activator instanceof TouchEvent ? activator.touches[0] : null;
    const origin =
      activator instanceof MouseEvent
        ? { x: activator.clientX, y: activator.clientY }
        : touch
          ? { x: touch.clientX, y: touch.clientY }
          : null;
    setDragPointer(origin);
  }, []);

  useEffect(() => {
    if (!activeDrag) return;
    const updateDragPointer = (event: PointerEvent | TouchEvent) => {
      const overlay = dragOverlayRef.current;
      if (!overlay) return;
      const touch = event instanceof TouchEvent ? event.touches[0] : null;
      const x = touch?.clientX ?? (event instanceof PointerEvent ? event.clientX : null);
      const y = touch?.clientY ?? (event instanceof PointerEvent ? event.clientY : null);
      if (x === null || y === null) return;
      overlay.style.transform = fileDragOverlayTransform(x, y);
    };
    window.addEventListener('pointermove', updateDragPointer, true);
    window.addEventListener('touchmove', updateDragPointer, true);
    return () => {
      window.removeEventListener('pointermove', updateDragPointer, true);
      window.removeEventListener('touchmove', updateDragPointer, true);
    };
  }, [activeDrag]);

  const clearActiveDrag = useCallback(() => {
    setDragPointer(null);
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const source = event.active.data.current as FileDragData | undefined;
      const target = event.over?.data.current as FileDropData | undefined;
      clearActiveDrag();
      if (source?.kind !== 'file' || !target) return;
      const effectiveTarget: DirectoryDropData | null =
        target.kind === 'directory'
          ? target
          : {
              kind: 'directory',
              paneIndex: target.paneIndex,
              hostId: target.hostId,
              targetDirectory: target.targetDirectory,
            };
      if (!effectiveTarget) return;
      const sourcePane = useBrowserStore.getState().panes[source.paneIndex];
      const files = sourcePane.selectedFiles.some(
        (selected) => selected.fullPath === source.file.fullPath,
      )
        ? sourcePane.selectedFiles
        : [source.file];
      const targetSeparator = effectiveTarget.targetDirectory.includes('\\') ? '\\' : '/';
      const targetsSourceOrDescendant =
        source.hostId === effectiveTarget.hostId &&
        files.some(
          (file) =>
            file.isDirectory &&
            (effectiveTarget.targetDirectory === file.fullPath ||
              effectiveTarget.targetDirectory.startsWith(`${file.fullPath}${targetSeparator}`)),
        );
      if (targetsSourceOrDescendant) {
        return;
      }
      if (
        source.hostId === effectiveTarget.hostId &&
        effectiveTarget.targetDirectory === sourcePane.currentPath
      ) {
        return;
      }
      setPendingDrop({ source, target: effectiveTarget, files });
    },
    [clearActiveDrag],
  );

  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return;
    const { source, target, files } = pendingDrop;
    setPendingDrop(null);
    const operation =
      source.hostId === target.hostId
        ? moveFiles(source.paneIndex, source.hostId, files, target.targetDirectory)
        : transferFiles(
            source.paneIndex,
            source.hostId,
            target.paneIndex,
            target.hostId,
            files,
            target.targetDirectory,
          );
    void operation.catch((error) => {
      setOperationMessage(
        t(source.hostId === target.hostId ? 'browser.moveFailed' : 'browser.transferFailed', {
          error: formatAppError(error),
        }),
        true,
      );
    });
  }, [moveFiles, pendingDrop, setOperationMessage, t, transferFiles]);
  const {
    theme,
    accentColor,
    backgroundImage,
    backgroundImageEnabled,
    backgroundOpacity,
    glassBlur,
    glassOpacity,
    fontSize,
    headingFontSize,
    labelFontSize,
    captionFontSize,
    dataFontSize,
    mobileTitlebarHeight,
    language,
    windowTopmost,
    setTheme,
    setWindowTopmost,
  } = useSettingsStore();

  const setPaneHost = useCallback(
    (pane: PaneIndex, hostId: string | null) => {
      setPaneHostIds((current) => {
        const next: [string | null, string | null] = [...current];
        next[pane] = hostId;
        return next;
      });
      setActivePane(pane);
    },
    [setActivePane],
  );

  useEffect(() => {
    const preventNativeContextMenu = (event: MouseEvent) => {
      if (
        document.documentElement.classList.contains('mobile-platform') &&
        isNativeTextContextTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener('contextmenu', preventNativeContextMenu, true);
    return () => document.removeEventListener('contextmenu', preventNativeContextMenu, true);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accentColor;
    document.documentElement.style.setProperty('--ui-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--type-body-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--type-heading-size', `${headingFontSize}px`);
    document.documentElement.style.setProperty('--type-label-size', `${labelFontSize}px`);
    document.documentElement.style.setProperty('--type-caption-size', `${captionFontSize}px`);
    document.documentElement.style.setProperty('--type-data-size', `${dataFontSize}px`);
    document.documentElement.style.setProperty('--glass-blur', `${glassBlur}px`);
    document.documentElement.style.setProperty('--glass-opacity', String(glassOpacity));
    document.documentElement.style.setProperty(
      '--glass-opacity-percent',
      `${Math.round(glassOpacity * 100)}%`,
    );
    void i18n.changeLanguage(language);
  }, [
    accentColor,
    captionFontSize,
    dataFontSize,
    fontSize,
    glassBlur,
    glassOpacity,
    headingFontSize,
    labelFontSize,
    language,
    theme,
  ]);

  useEffect(() => {
    let active = true;
    if (!backgroundImageEnabled || !backgroundImage) {
      setBackgroundImageSource(null);
      return () => {
        active = false;
      };
    }
    if (/^(data:|blob:|https?:)/i.test(backgroundImage)) {
      setBackgroundImageSource(backgroundImage);
      return () => {
        active = false;
      };
    }
    if (document.documentElement.classList.contains('mobile-platform')) {
      let objectUrl: string | null = null;
      void loadBackgroundImageBytes(backgroundImage)
        .then((bytes) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(
            new Blob([bytes], { type: backgroundImageMimeType(backgroundImage) }),
          );
          setBackgroundImageSource(objectUrl);
        })
        .catch(() => {
          if (active) setBackgroundImageSource(null);
        });
      return () => {
        active = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    void loadBackgroundImage(backgroundImage)
      .then((source) => {
        if (active) setBackgroundImageSource(source);
      })
      .catch(() => {
        if (active) setBackgroundImageSource(null);
      });
    return () => {
      active = false;
    };
  }, [backgroundImage, backgroundImageEnabled]);

  useEffect(() => {
    try {
      void getCurrentWindow()
        .setAlwaysOnTop(windowTopmost)
        .catch(() => undefined);
    } catch {
      // 浏览器预览没有 Tauri 窗口上下文。
    }
  }, [windowTopmost]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void onConnectionStatus((payload) => {
      if (!active) return;
      clearOperationMessage();
      setConnectionStatus(payload.hostId, payload.status);
      if (payload.status === 'reconnecting') {
        void reconnectHost(payload.hostId).catch(() => undefined);
      }
    })
      .then((dispose) => {
        if (active) unlisten = dispose;
        else dispose();
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unlisten?.();
    };
  }, [clearOperationMessage, reconnectHost, setConnectionStatus]);

  useEffect(() => {
    let active = true;
    const disposers: Array<() => void> = [];
    const register = async () => {
      const listeners = await Promise.all([
        onEditorSynced((payload) => {
          if (!active) return;
          setOperationMessage(
            t('editor.synced', { name: payload.fileName, time: payload.syncTime }),
          );
          paneHostIds.forEach((paneHostId, index) => {
            if (paneHostId === payload.hostId) void refresh(index as PaneIndex, payload.hostId);
          });
        }),
        onEditorError((payload) => {
          if (!active) return;
          setOperationMessage(
            t('editor.syncFailed', { name: payload.fileName, error: payload.message }),
            true,
          );
        }),
        onEditorSessionInvalid((payload) => {
          if (!active) return;
          const status = useConnectionStore.getState().connectionStatus[payload.hostId];
          if (status === 'connecting' || status === 'reconnecting' || status === 'connected')
            return;
          setOperationMessage(t('editor.sessionInvalid'));
        }),
      ]);
      if (active) disposers.push(...listeners);
      else listeners.forEach((dispose) => dispose());
    };
    void register().catch(() => undefined);
    return () => {
      active = false;
      disposers.forEach((dispose) => dispose());
    };
  }, [paneHostIds, refresh, setOperationMessage, t]);

  useEffect(() => {
    let active = true;
    const disposers: Array<() => void> = [];
    const register = async () => {
      const listeners = await Promise.all([
        onDownloadProgress((payload) => {
          if (!active) return;
          const current = useBrowserStore.getState().transfers[payload.operationId];
          if (!current || current.isCancelling || !current.isActive) return;
          updateTransfer(payload.operationId, {
            isActive: true,
            isSuccessful: false,
            percent: calculateTransferPercent(
              current.percent,
              current.currentIndex,
              current.totalCount,
              payload.percent,
              current.direction,
              'download',
            ),
            message:
              current.direction === 'remoteToRemote'
                ? current.message
                : t('browser.downloading', { name: payload.currentFile }),
            currentIndex: Math.max(current.currentIndex, 1),
            totalCount: Math.max(current.totalCount, 1),
            speed: payload.speed,
          });
        }),
        onDownloadDone((payload) => {
          if (!active) return;
          const current = useBrowserStore.getState().transfers[payload.operationId];
          if (!current || current.isCancelling || !current.isActive) return;
          updateTransfer(payload.operationId, {
            percent: calculateTransferPercent(
              current.percent,
              current.currentIndex,
              current.totalCount,
              payload.percent,
              current.direction,
              'download',
            ),
            speed: payload.speed,
          });
        }),
        onDownloadBatchProgress((payload) => {
          if (!active) return;
          const current = useBrowserStore.getState().transfers[payload.operationId];
          if (!current || current.isCancelling || !current.isActive) return;
          updateTransfer(payload.operationId, {
            isActive: true,
            isSuccessful: false,
            percent: calculateTransferPercent(
              current.percent,
              payload.currentIndex,
              payload.totalCount,
              payload.filePercent,
              current.direction,
              'download',
            ),
            message: t('browser.downloading', { name: payload.currentFile }),
            currentIndex: payload.currentIndex,
            totalCount: payload.totalCount,
          });
        }),
        onUploadProgress((payload) => {
          if (!active) return;
          const current = useBrowserStore.getState().transfers[payload.operationId];
          if (!current || current.isCancelling || !current.isActive) return;
          updateTransfer(payload.operationId, {
            isActive: true,
            isSuccessful: false,
            percent: calculateTransferPercent(
              current.percent,
              current.currentIndex,
              current.totalCount,
              payload.percent,
              current.direction,
              'upload',
            ),
            message:
              current.direction === 'remoteToRemote'
                ? current.message
                : t('browser.uploadingSingle', { name: payload.currentFile }),
            speed: payload.speed,
          });
        }),
        onUploadDone((payload) => {
          if (!active) return;
          const current = useBrowserStore.getState().transfers[payload.operationId];
          if (!current || current.isCancelling || !current.isActive) return;
          updateTransfer(payload.operationId, {
            percent: calculateTransferPercent(
              current.percent,
              current.currentIndex,
              current.totalCount,
              payload.percent,
              current.direction,
              'upload',
            ),
            speed: payload.speed,
          });
        }),
      ]);
      if (active) disposers.push(...listeners);
      else listeners.forEach((dispose) => dispose());
    };
    void register().catch(() => undefined);
    return () => {
      active = false;
      disposers.forEach((dispose) => dispose());
    };
  }, [t, updateTransfer]);

  useEffect(() => {
    if (connectedHostIds.length === 0) return;
    let active = true;
    const checkConnections = async () => {
      for (const hostId of connectedHostIds) {
        try {
          const status = await getConnectionStatus(hostId);
          if (active && !status.isConnected) {
            setConnectionStatus(hostId, 'reconnecting');
            await reconnectHost(hostId);
          }
        } catch {
          if (active) setConnectionStatus(hostId, 'error');
        }
      }
    };
    const timer = window.setInterval(() => void checkConnections(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [connectedHostIds, reconnectHost, setConnectionStatus]);

  useEffect(() => {
    clearDisconnectedPanes(connectedHostIds);
    setPaneHostIds((current) => reconcilePaneHosts(current, connectedHostIds, isDualPane));
  }, [clearDisconnectedPanes, connectedHostIds, isDualPane]);

  const assignHostToPane = useCallback(
    (hostId: string) => {
      setPaneHostIds((current) => {
        const activation = activateHostInPane(current, hostId, isDualPane, activePane);
        setActivePane(activation.activePane);
        return activation.hosts;
      });
    },
    [activePane, isDualPane, setActivePane],
  );

  const togglePanels = useCallback(() => {
    setIsDualPane((dual) => {
      if (dual) setPaneHostIds((current) => collapseToSinglePane(current));
      return !dual;
    });
  }, []);

  const activeHostId = paneHostIds[activePane];
  const currentHost = activeHostId
    ? (hosts.find((host) => host.id === activeHostId) ?? null)
    : null;

  const resetMobileHostDrawerPaint = useCallback(() => {
    if (mobileHostDrawerFrameRef.current !== null) {
      window.cancelAnimationFrame(mobileHostDrawerFrameRef.current);
      mobileHostDrawerFrameRef.current = null;
    }
    mobileHostDrawerRef.current?.style.removeProperty('--mobile-host-drawer-translate');
  }, []);

  useEffect(
    () => () => {
      if (mobileHostDrawerSettleTimerRef.current !== null) {
        window.clearTimeout(mobileHostDrawerSettleTimerRef.current);
      }
    },
    [],
  );

  const paintMobileHostDrawerProgress = useCallback((progress: number) => {
    mobileHostDrawerProgressRef.current = progress;
    if (mobileHostDrawerFrameRef.current !== null) return;
    mobileHostDrawerFrameRef.current = window.requestAnimationFrame(() => {
      mobileHostDrawerFrameRef.current = null;
      const workspace = mobileHostDrawerRef.current;
      if (!workspace) return;
      const nextProgress = mobileHostDrawerProgressRef.current;
      workspace.style.setProperty(
        '--mobile-host-drawer-translate',
        mobileDrawerTranslate(nextProgress),
      );
    });
  }, []);

  const finishMobileHostDrawerDrag = useCallback(
    (open: boolean) => {
      if (mobileHostDrawerFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileHostDrawerFrameRef.current);
        mobileHostDrawerFrameRef.current = null;
      }
      if (mobileHostDrawerSettleTimerRef.current !== null) {
        window.clearTimeout(mobileHostDrawerSettleTimerRef.current);
      }
      const workspace = mobileHostDrawerRef.current;
      const currentProgress = mobileHostDrawerProgressRef.current;
      workspace?.style.setProperty(
        '--mobile-host-drawer-translate',
        mobileDrawerTranslate(currentProgress),
      );
      setIsMobileHostDrawerOpen(open);
      setIsMobileHostDrawerSettling(true);
      window.requestAnimationFrame(() => {
        const targetProgress = open ? 1 : 0;
        mobileHostDrawerProgressRef.current = targetProgress;
        workspace?.style.setProperty(
          '--mobile-host-drawer-translate',
          mobileDrawerTranslate(targetProgress),
        );
        mobileHostDrawerSettleTimerRef.current = window.setTimeout(() => {
          mobileHostDrawerSettleTimerRef.current = null;
          setIsMobileHostDrawerDragging(false);
          setIsMobileHostDrawerSettling(false);
          resetMobileHostDrawerPaint();
        }, 300);
      });
    },
    [resetMobileHostDrawerPaint],
  );

  const closeMobileHostDrawer = useCallback(() => {
    if (mobileHostDrawerSettleTimerRef.current !== null) {
      window.clearTimeout(mobileHostDrawerSettleTimerRef.current);
      mobileHostDrawerSettleTimerRef.current = null;
    }
    setIsMobileHostDrawerDragging(false);
    setIsMobileHostDrawerSettling(false);
    setIsMobileHostDrawerOpen(false);
    resetMobileHostDrawerPaint();
  }, [resetMobileHostDrawerPaint]);

  const handleGlobalDrawerTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      mobileDrawerGestureRef.current = null;
      mobileDrawerGestureConsumedRef.current = false;
      const target = event.target;
      if (
        activeDrag ||
        isMobileHostDrawerSettling ||
        hasActiveAppOverlay() ||
        !document.documentElement.classList.contains('mobile-platform') ||
        event.touches.length !== 1 ||
        isNativeTextContextTarget(target) ||
        (target instanceof Element && target.closest('[data-drawer-gesture="exclude"]'))
      ) {
        return;
      }
      const touch = event.touches[0];
      mobileDrawerGestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        width: Math.max(1, window.innerWidth),
        initiallyOpen: isMobileHostDrawerOpen,
        horizontal: false,
      };
      mobileHostDrawerProgressRef.current = isMobileHostDrawerOpen ? 1 : 0;
    },
    [activeDrag, isMobileHostDrawerOpen, isMobileHostDrawerSettling],
  );

  const handleGlobalDrawerTouchMove = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const gesture = mobileDrawerGestureRef.current;
      const touch = event.touches[0];
      if (!gesture || !touch) return;
      if (activeDrag || hasActiveAppOverlay()) {
        mobileDrawerGestureRef.current = null;
        if (gesture.horizontal) finishMobileHostDrawerDrag(gesture.initiallyOpen);
        return;
      }
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (!gesture.horizontal) {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          mobileDrawerGestureRef.current = null;
          return;
        }
        gesture.horizontal = true;
        setIsMobileHostDrawerDragging(true);
      }
      event.preventDefault();
      paintMobileHostDrawerProgress(
        mobileDrawerDragProgress(
          gesture.startX,
          touch.clientX,
          gesture.width,
          gesture.initiallyOpen,
        ),
      );
    },
    [activeDrag, finishMobileHostDrawerDrag, paintMobileHostDrawerProgress],
  );

  const handleGlobalDrawerTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const gesture = mobileDrawerGestureRef.current;
      mobileDrawerGestureRef.current = null;
      const touch = event.changedTouches[0];
      if (!gesture || !touch || !gesture.horizontal || hasActiveAppOverlay()) {
        if (gesture?.horizontal) finishMobileHostDrawerDrag(gesture.initiallyOpen);
        return;
      }
      const deltaX = touch.clientX - gesture.startX;
      const progress = mobileDrawerDragProgress(
        gesture.startX,
        touch.clientX,
        gesture.width,
        gesture.initiallyOpen,
      );
      paintMobileHostDrawerProgress(progress);
      mobileDrawerGestureConsumedRef.current = true;
      window.setTimeout(() => {
        mobileDrawerGestureConsumedRef.current = false;
      }, 500);
      finishMobileHostDrawerDrag(settleMobileDrawer(progress, deltaX));
    },
    [finishMobileHostDrawerDrag, paintMobileHostDrawerProgress],
  );

  const handleGlobalDrawerTouchCancel = useCallback(() => {
    const gesture = mobileDrawerGestureRef.current;
    mobileDrawerGestureRef.current = null;
    if (gesture?.horizontal) finishMobileHostDrawerDrag(gesture.initiallyOpen);
  }, [finishMobileHostDrawerDrag]);

  const handleGlobalDrawerClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!mobileDrawerGestureConsumedRef.current) return;
    mobileDrawerGestureConsumedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const appStyle = {
    ...(backgroundImageEnabled && backgroundImageSource
      ? {
          '--app-background-image': `url(${JSON.stringify(backgroundImageSource)})`,
        }
      : {}),
    '--ui-font-size': `${fontSize}px`,
    '--type-body-size': `${fontSize}px`,
    '--type-heading-size': `${headingFontSize}px`,
    '--type-label-size': `${labelFontSize}px`,
    '--type-caption-size': `${captionFontSize}px`,
    '--type-data-size': `${dataFontSize}px`,
    '--mobile-titlebar-content-height': `${mobileTitlebarHeight}px`,
    '--app-background-opacity': backgroundOpacity,
    '--glass-blur': `${glassBlur}px`,
    '--glass-opacity': glassOpacity,
    '--glass-opacity-percent': `${Math.round(glassOpacity * 100)}%`,
  } as CSSProperties;

  return (
    <main
      className="app-shell"
      data-theme={theme}
      data-accent={accentColor}
      data-has-background={Boolean(backgroundImageEnabled && backgroundImageSource)}
      style={appStyle}
      onTouchStart={handleGlobalDrawerTouchStart}
      onTouchMove={handleGlobalDrawerTouchMove}
      onTouchEnd={handleGlobalDrawerTouchEnd}
      onTouchCancel={handleGlobalDrawerTouchCancel}
      onClickCapture={handleGlobalDrawerClickCapture}
    >
      <AppTitleBar
        currentHost={currentHost}
        theme={theme}
        isDualPane={isDualPane}
        isHostPanelVisible={isHostPanelVisible}
        isTopmost={windowTopmost}
        isRefreshing={panes[activePane].isLoading}
        vaultStatus={vaultStatus}
        onBack={() => setPaneHost(activePane, null)}
        onRefresh={() => {
          if (activeHostId) void refresh(activePane, activeHostId);
        }}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onToggleHostPanel={() => setIsHostPanelVisible((visible) => !visible)}
        onToggleTopmost={() => setWindowTopmost(!windowTopmost)}
        onTogglePanels={togglePanels}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <div className="page-stage">
        <div
          ref={mobileHostDrawerRef}
          className={cn(
            'glass-workspace',
            paneHostIds[0] && 'glass-workspace--browsing',
            !isHostPanelVisible && 'glass-workspace--host-hidden',
            isMobileHostDrawerOpen && 'glass-workspace--mobile-drawer-open',
            isMobileHostDrawerDragging && 'glass-workspace--mobile-drawer-dragging',
            isMobileHostDrawerSettling && 'glass-workspace--mobile-drawer-settling',
          )}
        >
          <HostList
            onSelectHost={(hostId) => {
              assignHostToPane(hostId);
              closeMobileHostDrawer();
            }}
          />
          <button
            className="mobile-host-drawer-scrim"
            type="button"
            aria-label={t('titlebar.hideHosts')}
            tabIndex={isMobileHostDrawerOpen ? 0 : -1}
            onClick={closeMobileHostDrawer}
          />
          <DndContext
            sensors={dragSensors}
            autoScroll={false}
            collisionDetection={dragCollisionDetection}
            onDragStart={handleDragStart}
            onDragCancel={clearActiveDrag}
            onDragEnd={handleDragEnd}
          >
            <div
              className={
                isDualPane ? 'workspace-panels workspace-panels--dual' : 'workspace-panels'
              }
            >
              {paneHostIds[0] ? (
                <BrowserPage
                  paneIndex={0}
                  hostId={paneHostIds[0]}
                  onHostChange={(hostId) => setPaneHost(0, hostId)}
                />
              ) : (
                <WorkspaceLanding onOpen={(hostId) => setPaneHost(0, hostId)} />
              )}
              {isDualPane &&
                (paneHostIds[1] ? (
                  <BrowserPage
                    paneIndex={1}
                    hostId={paneHostIds[1]}
                    onHostChange={(hostId) => setPaneHost(1, hostId)}
                  />
                ) : (
                  <WorkspaceLanding onOpen={(hostId) => setPaneHost(1, hostId)} />
                ))}
            </div>
          </DndContext>
          {activeDrag && dragPointer && (
            <ModalPortal>
              <div
                ref={dragOverlayRef}
                className="file-drag-overlay"
                style={{
                  transform: fileDragOverlayTransform(dragPointer.x, dragPointer.y),
                }}
              >
                {panes[activeDrag.paneIndex].selectedFiles.length > 1
                  ? t('browser.dragCount', {
                      count: panes[activeDrag.paneIndex].selectedFiles.length,
                    })
                  : activeDrag.file.name}
              </div>
            </ModalPortal>
          )}
        </div>
      </div>
      <GlobalStatusBar />
      {isSettingsOpen && <SettingsDialog onClose={handleSettingsClose} />}
      {pendingDrop && (
        <ConfirmDialog
          title={t(
            pendingDrop.source.hostId === pendingDrop.target.hostId
              ? 'browser.confirmMove'
              : 'browser.confirmTransfer',
          )}
          message={t('browser.dropMessage', {
            count: pendingDrop.files.length,
            action: t(
              pendingDrop.source.hostId === pendingDrop.target.hostId
                ? 'browser.move'
                : 'browser.transfer',
            ),
            target: pendingDrop.target.targetDirectory,
          })}
          confirmLabel={t(
            pendingDrop.source.hostId === pendingDrop.target.hostId
              ? 'browser.move'
              : 'browser.transfer',
          )}
          onConfirm={confirmDrop}
          onCancel={() => setPendingDrop(null)}
        />
      )}
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
