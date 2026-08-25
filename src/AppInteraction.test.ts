import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app shell interaction wiring', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
  const connectionStore = readFileSync(
    new URL('./stores/connectionStore.ts', import.meta.url),
    'utf8',
  );

  it('isolates mobile UI behind the native platform signal', () => {
    const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
    const backend = readFileSync(
      new URL('../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    expect(main).toContain("classList.add('mobile-platform')");
    expect(backend).toContain('cfg!(mobile)');
    expect(css).toMatch(/\.titlebar-mobile-drawer-button[\s\S]*?display:\s*none/);
    expect(css).toContain('html.mobile-platform');
    expect(css).toContain('--mobile-safe-top: env(safe-area-inset-top, 0px)');
    expect(css).toContain('.workspace-pane--welcome');
    expect(css).toMatch(/html\.mobile-platform[\s\S]*?\.settings-layout\s*\{/);
  });

  it('builds the host sidebar visibility classes as independent tokens', () => {
    expect(source).toMatch(/cn\(\s*'glass-workspace'/);
    expect(source).toContain("!isHostPanelVisible && 'glass-workspace--host-hidden'");
  });

  it('does not reinitialize a pane when another host capability changes', () => {
    expect(source).toContain('const activeCapability = hostCapabilities[hostId] ?? null');
    expect(source).not.toContain(
      '[hostCapabilities, hostId, initializeDirectory, paneIndex, setCapabilities]',
    );
  });

  it('makes the complete sortable header cell clickable and aligned', () => {
    const fileList = readFileSync(
      new URL('./features/browser/FileList.tsx', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(/\.file-sort-button\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
    expect(fileList.indexOf('ref={setScrollRef}')).toBeLessThan(
      fileList.indexOf('className="file-table-header"'),
    );
    expect(fileList).toContain('onPointerDown={(event) => event.stopPropagation()}');
    expect(css).toContain('--file-size-width:');
    expect(css).toContain('--file-owner-width:');
    expect(css).toContain('--file-permission-width:');
    expect(css).toContain('--file-date-width:');
  });

  it('lets settings glass consume the same global blur and opacity controls', () => {
    expect(css).toMatch(
      /\.settings-panel\s*\{[^}]*var\(--glass-opacity-percent[^}]*var\(--glass-blur/s,
    );
  });

  it('lets Android use every configured typography tier instead of platform overrides', () => {
    expect(source).toContain("'--type-body-size': `${fontSize}px`");
    expect(source).toContain("'--type-heading-size': `${headingFontSize}px`");
    expect(source).toContain("'--type-label-size': `${labelFontSize}px`");
    expect(source).toContain("'--type-caption-size': `${captionFontSize}px`");
    expect(source).toContain("'--type-data-size': `${dataFontSize}px`");
    expect(css).not.toMatch(
      /html\.mobile-platform[\s\S]*?\.app-shell\s*\{[^}]*--(?:ui-font|type-(?:body|heading|label|caption|data))-size:/s,
    );
  });

  it('keeps Android native text actions available inside editable controls', () => {
    expect(source).toContain(
      "document.addEventListener('contextmenu', preventNativeContextMenu, true)",
    );
    expect(source).toContain('isNativeTextContextTarget');
    expect(source).toMatch(
      /classList\.contains\('mobile-platform'\)[\s\S]*?isNativeTextContextTarget\(event\.target\)[\s\S]*?return/,
    );
    expect(source).toMatch(
      /handleGlobalDrawerTouchStart[\s\S]*?isNativeTextContextTarget\(target\)/,
    );
  });

  it('tracks the drag preview from raw pointer coordinates instead of scroll-adjusted deltas', () => {
    expect(source).toContain("window.addEventListener('pointermove', updateDragPointer, true)");
    expect(source).toContain('event.clientX');
    expect(source).toContain('event.clientY');
    expect(source).not.toContain('event.delta.x');
    expect(source).not.toContain('event.delta.y');
    expect(source).toContain('fileDragOverlayTransform');
    expect(source).toContain('MOBILE_FILE_DRAG_GAP');
    expect(source).toContain("classList.contains('mobile-platform')");
    expect(source).toContain('${x + 12}px');
    expect(source).toContain('mobileFileDragRect');
    expect(source).toContain('dragOverlayRef.current?.offsetWidth');
    expect(source).toContain('dragOverlayRef.current?.offsetHeight');
    expect(source).toContain('rectIntersection');
    expect(source).toContain("collision.data?.droppableContainer.data.current?.kind === 'pane'");
  });

  it('keeps batch progress ownership in the initiating flow and shows count plus speed', () => {
    expect(source).toContain('transfer.currentIndex');
    expect(source).toContain('transfer.totalCount');
    expect(source).toContain('formatTransferSpeed(transfer.speed)');
    expect(source).not.toMatch(/onDownloadDone\(\(\) =>[\s\S]*?isActive:\s*false/);
  });

  it('models simultaneous transfers independently and exposes cancellation', () => {
    expect(source).toContain('transfers');
    expect(source).toContain('cancelTransfer');
    expect(source).toContain('transfer-spinner');
    expect(source).toContain('operationId');
  });

  it('accepts native Explorer paths through the Tauri drag-drop event', () => {
    expect(source).toContain('onDragDropEvent');
    expect(source).toContain('handlePickedPaths');
    expect(source).toContain('event.payload.paths');
  });

  it('consumes backend connection health events and immediately starts recovery', () => {
    expect(source).toContain("payload.status === 'reconnecting'");
    expect(source).toContain('reconnectHost(payload.hostId)');
    expect(connectionStore).toContain('isDisconnected || isError');
  });

  it('shows connection activity in the global status bar', () => {
    expect(connectionStore).toContain("[id]: 'connecting'");
    expect(source).toContain('status-loading-spinner');
    expect(source).toContain("status === 'connecting' || status === 'reconnecting'");
  });

  it('shows vault sync metadata in the desktop status bar and Android titlebar', () => {
    expect(source).toContain('useVaultSyncStore');
    expect(source).toContain('vault-status-meta');
    expect(source).toContain('lastSyncedAt');
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.titlebar-mobile-vault\s*\{[^}]*display:\s*flex/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.status-meta\s*>\s*\.vault-status-meta\s*\{[^}]*display:\s*none/s,
    );
  });

  it('hides file metadata after the active pane host disconnects', () => {
    expect(source).toContain('clearDisconnectedPanes(connectedHostIds)');
    expect(source).toContain('isPaneConnected &&');
  });

  it('keeps the file count on one line so it cannot compress vault metadata', () => {
    expect(source).toContain('status-file-count');
    expect(css).toMatch(
      /\.status-file-count\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*white-space:\s*nowrap;/s,
    );
    expect(css).toMatch(/\.vault-status-meta\s*>\s*time\s*\{[^}]*flex:\s*0\s+0\s+auto;/s);
    expect(css).toMatch(/\.status-meta\s*>\s*\.vault-status-meta\s*\{[^}]*flex:\s*0\s+1\s+auto;/s);
  });

  it('clears stale operation notices when a newer connection lifecycle starts', () => {
    const browserStore = readFileSync(new URL('./stores/browserStore.ts', import.meta.url), 'utf8');
    expect(browserStore).toContain('clearOperationMessage');
    expect(source).toMatch(/onConnectionStatus\([\s\S]*?clearOperationMessage\(\)/);
    expect(source).toContain("status === 'connecting' || status === 'reconnecting'");
  });

  it('maps Ctrl+A to active-pane file selection instead of browser text selection', () => {
    expect(source).toContain("event.key.toLowerCase() !== 'a'");
    expect(source).toContain('event.preventDefault()');
    expect(source).toContain('window.getSelection()?.removeAllRanges()');
    expect(source).toContain("file.name !== '..'");
    expect(css).toMatch(/body\s*\{[^}]*user-select:\s*none/s);
    expect(css).toMatch(
      /input,[\s\S]*?textarea,[\s\S]*?\[contenteditable='true'\][^{]*\{[^}]*user-select:\s*text/s,
    );
    expect(css).toMatch(/\.global-status-bar[^{]*\{[^}]*user-select:\s*text/s);
  });

  it('animates the pane host menu and both directions of host sidebar visibility', () => {
    expect(css).toMatch(/\.pane-host-menu,[\s\S]*?animation:\s*glass-rise/);
    expect(css).toMatch(/\.glass-workspace\s*\{[^}]*transition:/s);
    expect(css).toMatch(/\.host-sidebar\s*\{[^}]*transition:/s);
    expect(css).not.toMatch(
      /\.glass-workspace--host-hidden \.host-sidebar\s*\{[^}]*display:\s*none/s,
    );
  });

  it('freezes visible progress while cancellation is pending without a wait cursor', () => {
    expect(source).toContain('if (!current || current.isCancelling || !current.isActive) return;');
    expect(source).toContain('transfer-cancel-spinner');
    expect(css).not.toMatch(/\.transfer-cancel:disabled\s*\{[^}]*cursor:\s*wait/s);
  });

  it('keeps cancelled transfers neutral instead of styling connection status as an error', () => {
    const browserStore = readFileSync(new URL('./stores/browserStore.ts', import.meta.url), 'utf8');
    expect(browserStore).toContain('isCancelled: boolean');
    expect(source).toContain('!transfer.isCancelled');
  });

  it('centers a single transfer task in the complete status bar', () => {
    expect(css).toMatch(
      /\.transfer-status > \.transfer-task:only-child\s*\{[^}]*margin-inline:\s*auto/s,
    );
  });

  it('maps desktop file shortcuts without stealing keys from editable surfaces', () => {
    expect(source).toContain("event.key === 'Delete'");
    expect(source).toContain("event.key === 'F2'");
    expect(source).toContain("setDialog({ type: 'deleteConfirm' })");
    expect(source).toContain("setDialog({ type: 'rename', file: selectedFiles[0] })");
    expect(source).toContain('[role="menu"]');
  });

  it('provides Android-specific path editing and delayed touch dragging', () => {
    const breadcrumb = readFileSync(
      new URL('./features/browser/Breadcrumb.tsx', import.meta.url),
      'utf8',
    );
    const fileList = readFileSync(
      new URL('./features/browser/FileList.tsx', import.meta.url),
      'utf8',
    );
    const dragSensors = readFileSync(new URL('./lib/dragSensors.ts', import.meta.url), 'utf8');
    expect(source).toContain('TouchSensor');
    expect(source).toContain('useSensor(TouchSensor');
    expect(source).toContain('useSensor(PlatformPointerSensor');
    expect(dragSensors).toContain("event.pointerType === 'touch'");
    expect(dragSensors).toContain("classList.contains('mobile-platform')");
    expect(source).toMatch(
      /className="icon-button path-edit-action"[\s\S]*?title=\{t\('browser\.editPath'\)\}/,
    );
    expect(breadcrumb).toContain('breadcrumb-edit-button');
    expect(breadcrumb).toContain('onEditingChange(true)');
    expect(fileList).toContain("classList.contains('mobile-platform')");
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.browser-toolbar\s*\{[^}]*grid-template-areas:[^}]*path[^}]*actions/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.breadcrumb\s*\{[^}]*border-radius:[^}]*overflow:\s*hidden/s,
    );
  });

  it('keeps host favorites ahead of Home on desktop and exposes Home on Android', () => {
    const favoriteMenu = readFileSync(
      new URL('./features/browser/FavoriteFoldersMenu.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toMatch(
      /<div className="path-actions">[\s\S]*?<FavoriteFoldersMenu[\s\S]*?<button[\s\S]*?title=\{t\('browser\.home'\)\}/,
    );
    expect(source).toMatch(
      /className="mobile-file-actions"[\s\S]*?<FavoriteFoldersMenu[\s\S]*?mobile[\s\S]*?mobile-home-action[\s\S]*?browser\.home[\s\S]*?mobile-refresh-action/,
    );
    expect(source).toContain('onAddFavorite={(files) => void handleAddFavorite(files)}');
    expect(favoriteMenu).toContain('favoriteFolders');
    expect(favoriteMenu).toContain('canAddFavoriteFolder(null, selectedFiles)');
    expect(favoriteMenu).toContain('folder.path');
    expect(css).toContain('.favorite-folders-menu');
    expect(source).toContain('if (file === null) selectFiles(paneIndex, [])');
    expect(source).toContain('currentPath={pane.currentPath}');
  });

  it('keeps Android connection and item counts on the same status row', () => {
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.global-status-bar\s*\{[^}]*grid-template-areas:\s*'connection meta'/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.transfer-status:not\(\.transfer-status--visible\)\s*\{[^}]*display:\s*none/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.global-status-bar:has\(\.transfer-status--visible\)\s*\{[^}]*flex:\s*0\s+0\s+auto;[^}]*overflow:\s*hidden/s,
    );
  });

  it('keeps desktop Vault status readable and starts transfer tasks from the left side of the center cell', () => {
    expect(css).toContain(
      'grid-template-columns: minmax(220px, 1fr) minmax(270px, 1.1fr) minmax(300px, 1.4fr);',
    );
    expect(css).toMatch(/\.transfer-status\s*\{[^}]*justify-content:\s*flex-start/s);
    expect(css).toMatch(
      /\.vault-status-meta > span:first-of-type\s*\{[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip/s,
    );
    expect(css).toMatch(/\.transfer-task\s*\{[^}]*max-width:\s*100%[^}]*flex:\s*1\s+1\s+auto/s);
    expect(css).toMatch(
      /\.transfer-task-message\s*\{[^}]*min-width:\s*0[^}]*flex:\s*1\s+1\s+auto[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/s,
    );
    expect(css).toMatch(/\.status-progress-track\s*\{[^}]*flex:\s*0\s+0\s+auto/s);
    expect(css).toMatch(/\.transfer-status strong\s*\{[^}]*flex:\s*0\s+0\s+auto/s);
  });

  it('shows pane-aware Android drop feedback and keeps cross-host wording as copy', () => {
    const fileList = readFileSync(
      new URL('./features/browser/FileList.tsx', import.meta.url),
      'utf8',
    );
    expect(fileList).toContain("kind: 'pane'");
    expect(fileList).toContain('file-list-drop-hint');
    expect(fileList).toContain("'browser.copyInto'");
    expect(fileList).toContain("'browser.copyToCurrent'");
    expect(source).toMatch(
      /rectangleOverlapRatio\(previewRect, directoryRect\)\s*>\s*MOBILE_DIRECTORY_OVERLAP_THRESHOLD/,
    );
    expect(fileList).toContain('isCurrentDirectoryDropTarget');
    expect(fileList).toMatch(/kind:\s*'blocked'[\s\S]*?targetDirectory:\s*currentPath/);
    expect(source).toMatch(/target\.kind === 'directory'\s*\? target\s*:\s*\{/);
    expect(css).toMatch(/\.file-list--drop-target::before\s*\{[^}]*position:\s*absolute/s);
    expect(css).toMatch(/\.file-list--drop-target::before\s*\{[^}]*backdrop-filter:\s*blur/s);
    expect(css).toMatch(/\.file-list--drop-target::before\s*\{[^}]*border:\s*0/s);
    expect(css).toMatch(/\.file-list-drop-hint\s*\{[^}]*position:\s*absolute/s);
    expect(css).not.toMatch(/\.file-list--drop-target\s+\.file-scroll-area\s*\{[^}]*box-shadow:/s);
  });

  it('uses one Android panel surface instead of nesting a second bordered shell', () => {
    expect(css).toMatch(/html\.mobile-platform[\s\S]*?\.browser-page\s*\{[^}]*gap:\s*0/s);
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.browser-page\s*\{[^}]*padding:\s*0;[^}]*overflow:\s*hidden/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.browser-toolbar\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.file-workspace\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.file-table-header\s*\{[^}]*border-radius:\s*0/s,
    );
  });

  it('drives the Android host drawer with continuous progress and fully covers the workspace', () => {
    expect(source).toContain('mobileHostDrawerProgressRef');
    expect(source).toContain('mobileHostDrawerFrameRef');
    expect(source).toContain('paintMobileHostDrawerProgress');
    expect(source).toContain("'glass-workspace--mobile-drawer-dragging'");
    expect(source).toContain("'glass-workspace--mobile-drawer-settling'");
    expect(source).toContain('isMobileHostDrawerSettling');
    expect(source).toContain("'--mobile-host-drawer-translate'");
    expect(source).toContain('mobileDrawerTranslate(nextProgress)');
    expect(source).not.toContain('setMobileHostDrawerProgress');
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.glass-workspace--mobile-drawer-dragging \.host-sidebar\s*\{[^}]*transform:\s*translate3d\(var\(--mobile-host-drawer-translate\),\s*0,\s*0\)/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.glass-workspace--mobile-drawer-settling \.host-sidebar\s*\{[^}]*transition:[^}]*transform\s+280ms/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.app-shell\s*\{[^}]*--mobile-workspace-inset-x:\s*8px;[^}]*--mobile-workspace-inset-y:\s*6px;[^}]*--mobile-workspace-radius:\s*14px/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.workspace-panels\s*\{[^}]*padding:\s*var\(--mobile-workspace-inset-y\)\s+var\(--mobile-workspace-inset-x\)/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.glass-workspace,[\s\S]*?--mobile-host-drawer-translate:[^}]*position:\s*relative/s,
    );
    expect(css).toContain(
      '--mobile-host-drawer-translate: calc(-100% - var(--mobile-workspace-inset-x));',
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.host-sidebar,[\s\S]*?position:\s*absolute;[^}]*inset:\s*var\(--mobile-workspace-inset-y\)\s+var\(--mobile-workspace-inset-x\);[^}]*overflow:\s*hidden;[^}]*border-radius:\s*var\(--mobile-workspace-radius\)/s,
    );
    expect(source).toContain('handleGlobalDrawerTouchStart');
    expect(source).toContain('handleGlobalDrawerTouchMove');
    expect(source).toContain('onTouchStart={handleGlobalDrawerTouchStart}');
    expect(source).toContain('onTouchMove={handleGlobalDrawerTouchMove}');
    expect(source).toContain("classList.contains('mobile-platform')");
    expect(source).not.toContain('onToggleMobileHostDrawer=');
    expect(source).toContain('hasActiveAppOverlay()');
    expect(source).toMatch(/hasActiveAppOverlay\(\)[\s\S]*?mobileDrawerGestureRef\.current = null/);
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.app-shell:has\(\.transfer-status--visible\)[^{]*\{[^}]*--mobile-statusbar-safe-height:\s*72px/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.mobile-host-drawer-scrim\s*\{[^}]*background:\s*transparent;[^}]*opacity:\s*1/s,
    );
  });

  it('keeps the pane host connection controls desktop-only and exposes every saved host there', () => {
    const paneHostSelect = readFileSync(
      new URL('./features/browser/PaneHostSelect.tsx', import.meta.url),
      'utf8',
    );
    expect(paneHostSelect).toContain("classList.contains('mobile-platform')");
    expect(paneHostSelect).toContain('const visibleHosts = isMobilePlatform');
    expect(paneHostSelect).toContain("'common.connect'");
    expect(paneHostSelect).toContain("'common.disconnect'");
    expect(paneHostSelect).toContain('useHostConnectionFlow');
    expect(source).toMatch(/function WorkspaceLanding[\s\S]*?<PaneHostSelect/);
  });

  it('uses a compact horizontal Android action strip', () => {
    expect(source).toContain('data-drawer-gesture="exclude"');
    expect(source).toContain('closest(\'[data-drawer-gesture="exclude"]\')');
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.mobile-file-actions\s*\{[^}]*touch-action:\s*pan-x/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.mobile-file-action\s*\{[^}]*min-height:\s*34px;[^}]*flex-direction:\s*row/s,
    );
  });

  it('keeps the pane host menu compact while preserving desktop connection actions', () => {
    const hostSelect = readFileSync(
      new URL('./features/browser/PaneHostSelect.tsx', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(/\.pane-host-menu,[\s\S]*?width:\s*196px/s);
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.pane-host-menu\s*\{[^}]*width:\s*min\(164px,\s*calc\(100vw - 16px\)\)/s,
    );
    expect(css).toMatch(
      /\.pane-host-connection-action\s*\{[^}]*width:\s*30px[^}]*min-width:\s*30px/s,
    );
    expect(hostSelect).not.toMatch(
      /<span>\{t\(isConnected \? 'common\.disconnect' : 'common\.connect'\)\}<\/span>/,
    );
  });

  it('avoids full-screen backdrop blur on Android compositor surfaces', () => {
    expect(css).toContain(
      'Android WebView scrolling should not continuously re-rasterize full-screen blur layers.',
    );
    expect(css).toMatch(
      /\.app-titlebar,[\s\S]*?\.workspace-pane,[\s\S]*?\.browser-page,[\s\S]*?\.global-status-bar,[\s\S]*?\.pane-host-menu\s*\{[^}]*backdrop-filter:\s*none/s,
    );
  });

  it('keeps the file list mounted during refresh and resets only after path navigation', () => {
    const fileList = readFileSync(
      new URL('./features/browser/FileList.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('pane.isLoading && pane.files.length === 0');
    expect(fileList).toContain('previousPathRef');
    expect(fileList).toContain('parent.scrollTop = 0');
    expect(fileList).toContain('useLayoutEffect');
  });

  it('paints the file header strip behind the native scrollbar gutter on every platform', () => {
    expect(css).toContain('--file-header-bg:');
    expect(css).toMatch(
      /\.file-scroll-area\s*\{[^}]*background:\s*linear-gradient\([^}]*var\(--file-header-bg\)/s,
    );
    expect(css).toMatch(
      /\.file-scroll-area::?-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/s,
    );
  });

  it('uses a selection-driven Android file action strip without remote edit', () => {
    const fileList = readFileSync(
      new URL('./features/browser/FileList.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('mobile-file-actions');
    expect(source).toContain('mobile-refresh-action');
    expect(source).toContain('mobile-upload-action');
    expect(source).toContain("setDialog({ type: 'mkdir' })");
    expect(source).toContain("setDialog({ type: 'createFile' })");
    expect(source).toContain("setDialog({ type: 'deleteConfirm' })");
    expect(source).toContain('void handleOnlineEdit(mobileActionFile)');
    expect(fileList).toContain('mobile-file-checkbox');
    expect(fileList).toContain('mobile-select-all');
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.mobile-file-actions\s*\{[^}]*display:\s*flex/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.remote-edit-sessions\s*\{[^}]*display:\s*none/s,
    );
  });

  it('fixes Android selection, columns, breadcrumb controls, and touch drag previews', () => {
    expect(source).toContain('activator instanceof TouchEvent');
    expect(source).toContain('activator.touches[0]');
    expect(source).not.toContain("setOperationMessage(t('browser.invalidMove'), true)");
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.breadcrumb-edit-button\s*\{[^}]*position:\s*absolute[^}]*right:/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.file-row\.file-row--selected[^{]*\{[^}]*background:/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.file-owner-cell,[\s\S]*?\.file-permission-cell\s*\{[^}]*display:\s*none/s,
    );
  });
});
