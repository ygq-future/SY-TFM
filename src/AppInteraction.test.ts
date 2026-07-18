import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app shell interaction wiring', () => {
  const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
  const connectionStore = readFileSync(
    new URL('./stores/connectionStore.ts', import.meta.url),
    'utf8',
  );

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

  it('disables the native webview context menu without blocking app menus', () => {
    expect(source).toContain(
      "document.addEventListener('contextmenu', preventNativeContextMenu, true)",
    );
  });

  it('tracks the drag preview from raw pointer coordinates instead of scroll-adjusted deltas', () => {
    expect(source).toContain("window.addEventListener('pointermove', updateDragPointer, true)");
    expect(source).toContain('event.clientX');
    expect(source).toContain('event.clientY');
    expect(source).not.toContain('event.delta.x');
    expect(source).not.toContain('event.delta.y');
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
});
