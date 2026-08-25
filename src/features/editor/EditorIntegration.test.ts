import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('remote editor integration', () => {
  it('uses protocol-independent commands and a debounced temp-file watcher', () => {
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const watcher = readFileSync(
      new URL('../../../src-tauri/src/core/file_watcher.rs', import.meta.url),
      'utf8',
    );
    expect(commands).toContain('read_remote_text');
    expect(commands).toContain('start_remote_edit');
    expect(commands).toContain('stop_remote_edit');
    expect(watcher).toContain('SessionManager');
    expect(watcher).toContain('WatchDebounceMilliseconds');
    expect(watcher).toContain('AppDirectory::RemoteEditRoot');
    expect(watcher).toContain('AppEvent::EditorSynced');
    expect(watcher).not.toContain('russh');
    expect(watcher).not.toContain('reqwest');
  });

  it('opens only the managed temp directory and reports sync in the global status bar', () => {
    const capability = readFileSync(
      new URL('../../../src-tauri/capabilities/default.json', import.meta.url),
      'utf8',
    );
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    expect(capability).toContain('opener:allow-open-path');
    expect(capability).toContain('$TEMP/SY-TFM/**');
    expect(app).toContain('onEditorSynced');
    expect(app).toContain("t('editor.synced'");
    expect(app).toContain('openPath(remoteSession.localPath)');
  });

  it('keeps online edit sync as a quiet left-side status instead of a transfer card', () => {
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const saveStart = app.indexOf('onSave={async (content, expectedRevision)');
    const saveFlow = app.slice(saveStart, app.indexOf('\n          />', saveStart));
    expect(saveFlow).toContain("setEditorOperationMessage(\n                    t('editor.synced'");
    expect(saveFlow).toContain('uploadRemoteTextIfUnchanged');
    expect(saveFlow).not.toContain('startTransfer({');
    expect(saveFlow).not.toContain('updateTransfer(');
  });

  it('clears editor-owned notices when online edit closes or an external editor opens', () => {
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const onlineEditorStart = app.indexOf('{onlineEditor && (');
    const onlineEditorEnd = app.indexOf("{dialog?.type === 'mkdir'", onlineEditorStart);
    const onlineEditorFlow = app.slice(onlineEditorStart, onlineEditorEnd);
    const remoteEditStart = app.indexOf('const handleRemoteEdit');
    const remoteEditEnd = app.indexOf('const handleDelete', remoteEditStart);
    const remoteEditFlow = app.slice(remoteEditStart, remoteEditEnd);

    expect(onlineEditorFlow).toContain('clearEditorOperationMessage()');
    expect(remoteEditFlow).toContain('clearEditorOperationMessage()');
    expect(remoteEditFlow).not.toContain("t('editor.openedExternal'");
  });

  it('bounds the status bar and every transfer item to the typography-aware height', () => {
    const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(styles).toContain('--statusbar-height: clamp(');
    expect(styles).toContain('height: var(--statusbar-height);');
    expect(styles).toContain('overflow: hidden;');
    expect(styles).toContain('.transfer-task > svg');
  });

  it('detects online text from content while keeping external edit extension-gated', () => {
    const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const onlineStart = appSource.indexOf('const handleOnlineEdit');
    const remoteStart = appSource.indexOf('const handleRemoteEdit');
    const onlineFlow = appSource.slice(onlineStart, remoteStart);
    const remoteFlow = appSource.slice(remoteStart, appSource.indexOf('const handleDelete'));
    expect(onlineFlow).toContain('readRemoteTextSnapshot(hostId, file.fullPath)');
    expect(onlineFlow).not.toContain('isEditableTextFile(file.name)');
    expect(remoteFlow).toContain('isEditableTextFile(file.name)');
    expect(commands).toContain('remote_text_snapshot(bytes)');
    expect(commands).toContain("text.contains('\\0')");
  });

  it('reuses active remote edit watchers and exposes them from the path toolbar', () => {
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const watcher = readFileSync(
      new URL('../../../src-tauri/src/core/file_watcher.rs', import.meta.url),
      'utf8',
    );
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const sessionMenu = readFileSync(
      new URL('./RemoteEditSessionsMenu.tsx', import.meta.url),
      'utf8',
    );
    const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    const zh = readFileSync(new URL('../../locales/zh.json', import.meta.url), 'utf8');
    const en = readFileSync(new URL('../../locales/en.json', import.meta.url), 'utf8');
    expect(commands).toContain('list_remote_edit_sessions');
    expect(watcher).toContain('find_matching_session');
    expect(watcher).not.toContain('self.stop_matching(host_id, &remote_path)');
    expect(app).toContain('RemoteEditSessionsMenu');
    expect(sessionMenu).toContain('listRemoteEditSessions');
    expect(sessionMenu).toContain('stopRemoteEdit');
    expect(sessionMenu).toContain('const currentHostIdRef = useRef(hostId)');
    expect(sessionMenu).toContain('const hostLifecycleGenerationRef = useRef(0)');
    expect(sessionMenu).toContain('const requestGenerationRef = useRef(0)');
    const layoutEffectStart = sessionMenu.indexOf('useLayoutEffect(() =>');
    const layoutEffectEnd = sessionMenu.indexOf('\n\n  useEffect(', layoutEffectStart);
    const layoutEffect = sessionMenu.slice(layoutEffectStart, layoutEffectEnd);
    const beforeLayoutEffect = sessionMenu.slice(0, layoutEffectStart);
    expect(beforeLayoutEffect).not.toContain('currentHostIdRef.current = hostId');
    expect(layoutEffect).toContain('currentHostIdRef.current = hostId');
    expect(layoutEffect).toContain('hostLifecycleGenerationRef.current += 1');
    expect(layoutEffect).toContain('requestGenerationRef.current += 1');
    expect(sessionMenu).toContain('useLayoutEffect(() =>');
    expect(sessionMenu).toContain('setSessions([])');
    expect(sessionMenu).toContain('setStoppingSessionIds(new Set())');
    expect(sessionMenu).toContain('const requestGeneration = ++requestGenerationRef.current');
    expect(sessionMenu).toContain('currentHostIdRef.current === requestedHostId');
    expect(sessionMenu).toContain('requestGenerationRef.current === requestGeneration');
    expect(sessionMenu).toContain('const stoppedHostId = hostId');
    expect(sessionMenu).toContain(
      'const stoppedHostGeneration = hostLifecycleGenerationRef.current',
    );
    expect(sessionMenu).toContain('currentHostIdRef.current === stoppedHostId');
    expect(sessionMenu).toContain('hostLifecycleGenerationRef.current === stoppedHostGeneration');
    expect(sessionMenu).toContain('await stopRemoteEdit(editSessionId)');
    expect(sessionMenu).toContain('current.filter((item) => item.editSessionId !== editSessionId)');
    const stopHandlerStart = sessionMenu.indexOf('const handleStop = async');
    const stopHandlerEnd = sessionMenu.indexOf('\n\n  return (', stopHandlerStart);
    const stopHandler = sessionMenu.slice(stopHandlerStart, stopHandlerEnd);
    const stopSuccessStart = stopHandler.indexOf('await stopRemoteEdit(editSessionId)');
    const stopCatchStart = stopHandler.indexOf('} catch (error)');
    const stopSuccess = stopHandler.slice(stopSuccessStart, stopCatchStart);
    const stopFinallyStart = stopHandler.indexOf('} finally {');
    const stopCatch = stopHandler.slice(stopCatchStart, stopFinallyStart);
    const stopFinally = stopHandler.slice(stopFinallyStart);
    expect(stopHandler).not.toContain('setIsOpen');
    expect(stopHandler).not.toContain('onOpen');
    expect(stopHandler).not.toContain('confirm');
    expect(stopSuccess.indexOf('requestGenerationRef.current += 1')).toBeGreaterThan(-1);
    expect(stopSuccess.indexOf('requestGenerationRef.current += 1')).toBeLessThan(
      stopSuccess.indexOf('setIsLoading(false)'),
    );
    expect(stopSuccess.indexOf('setIsLoading(false)')).toBeLessThan(
      stopSuccess.indexOf('setSessions'),
    );
    expect(stopCatch).not.toContain('setIsLoading');
    expect(stopCatch).not.toContain('current.filter');
    expect(stopFinally).toContain('next.delete(editSessionId)');
    expect(sessionMenu).toContain('className="remote-edit-session-item"');
    expect(sessionMenu).toContain('className="remote-edit-session-open"');
    expect(sessionMenu).toContain('className="remote-edit-session-stop"');
    expect(sessionMenu).toMatch(
      /className="remote-edit-session-open"[\s\S]*?<\/button>\s*<button\s+className="remote-edit-session-stop"/,
    );
    const openButtonStart = sessionMenu.indexOf('className="remote-edit-session-open"');
    const openButtonEnd = sessionMenu.indexOf('</button>', openButtonStart);
    const openButton = sessionMenu.slice(openButtonStart, openButtonEnd);
    expect(openButton).toContain('disabled={isStopping}');
    expect(openButton).toContain('if (isStopping) return');
    const stopButtonStart = sessionMenu.indexOf('className="remote-edit-session-stop"');
    const stopButtonEnd = sessionMenu.indexOf('</button>', stopButtonStart);
    const stopButton = sessionMenu.slice(stopButtonStart, stopButtonEnd);
    expect(stopButton).toContain('title={stopLabel}');
    expect(stopButton).toContain('aria-label={stopLabel}');
    expect(stopButton).toContain('disabled={isStopping}');
    expect(stopButton).toContain('<LoaderCircle className="is-spinning" /> : <X />');
    expect(sessionMenu).toContain('role="alert"');
    expect(sessionMenu).toContain('className="remote-edit-session-list" role="list"');
    expect(sessionMenu).toMatch(/className="remote-edit-session-item"[\s\S]*?role="listitem"/);
    expect(sessionMenu).not.toContain('role="menu"');
    expect(sessionMenu).not.toContain('role="menuitem"');
    expect(sessionMenu).toContain('loadErrorMessage && sessions.length === 0');
    expect(sessionMenu).toContain("t('editor.stopSession'");
    expect(sessionMenu).toContain("t('editor.stopSessionFailed'");
    expect(sessionMenu).toContain('const [loadErrorMessage, setLoadErrorMessage]');
    expect(sessionMenu).toContain('const [stopErrorMessage, setStopErrorMessage]');
    expect(styles).toContain('.remote-edit-session-stop');
    expect(styles).toContain('.remote-edit-session-open:hover:not(:disabled)');
    expect(styles).toContain('.remote-edit-session-open:focus-visible:not(:disabled)');
    expect(styles).toContain('.remote-edit-session-open:disabled');
    expect(styles).toContain('cursor: wait;');
    expect(zh).toContain('"stopSession"');
    expect(zh).toContain('"stopSessionFailed"');
    expect(en).toContain('"stopSession"');
    expect(en).toContain('"stopSessionFailed"');
  });

  it('opens desktop online edit in a unique independent window', () => {
    const launcher = readFileSync(new URL('./editorWindowLauncher.ts', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../../main.tsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const capability = readFileSync(
      new URL('../../../src-tauri/capabilities/default.json', import.meta.url),
      'utf8',
    );
    const launcherCapability = readFileSync(
      new URL('../../../src-tauri/capabilities/editor-launcher.json', import.meta.url),
      'utf8',
    );
    expect(launcher).toContain('new WebviewWindow(label');
    expect(launcher).toContain('crypto.randomUUID()');
    expect(launcher).toContain('new URLSearchParams');
    expect(launcher).toContain('visible: true');
    expect(launcher).toContain('decorations: false');
    expect(launcher).toContain('transparent: true');
    expect(main).toContain('<EditorWindow />');
    expect(main).toContain('isEditorWindow()');
    expect(main).toContain('const settings = useSettingsStore.getState()');
    expect(main).toContain('document.documentElement.dataset.theme = settings.theme');
    expect(main).toContain('document.documentElement.dataset.accent = settings.accentColor');
    const embeddedEditorStart = app.indexOf('<OnlineEditor');
    const embeddedEditorEnd = app.indexOf('/>', embeddedEditorStart);
    expect(app.slice(embeddedEditorStart, embeddedEditorEnd)).not.toContain('windowed');
    const editorWindow = readFileSync(new URL('./EditorWindow.tsx', import.meta.url), 'utf8');
    expect(editorWindow).toContain('app-shell editor-window-shell');
    expect(editorWindow).toContain('data-theme={theme}');
    expect(editorWindow).toContain('data-accent={accentColor}');
    expect(editorWindow).toContain('loadBackgroundImage(backgroundImage)');
    expect(capability).toContain('editor-*');
    expect(launcherCapability).toContain('core:webview:allow-create-webview-window');
    expect(launcherCapability).toContain('"main"');
  });

  it('uses a remote revision for polling and blocks stale saves', () => {
    const editor = readFileSync(new URL('./OnlineEditor.tsx', import.meta.url), 'utf8');
    const editorWindow = readFileSync(new URL('./EditorWindow.tsx', import.meta.url), 'utf8');
    const sync = readFileSync(new URL('./editorSync.ts', import.meta.url), 'utf8');
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    expect(editor).toContain('setInterval');
    expect(editor).toContain('classifyRemoteChange');
    expect(editor).toContain('isBlockedByConflict');
    expect(editorWindow).toContain('uploadRemoteTextIfUnchanged');
    expect(sync).toContain("return content === savedContent ? 'reload' : 'conflict'");
    expect(commands).toContain('read_remote_text_snapshot');
    expect(commands).toContain('upload_remote_text_if_unchanged');
    expect(commands).toContain('expected_revision');
    expect(commands).toContain('ErrorCode::SyncConflict');
  });
});
