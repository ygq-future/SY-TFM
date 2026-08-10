import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CapabilityConfig {
  permissions: string[];
}

describe('AppTitleBar native permissions', () => {
  it('grants every native window action used by the custom titlebar', () => {
    const configUrl = new URL('../../../src-tauri/capabilities/default.json', import.meta.url);
    const config = JSON.parse(readFileSync(configUrl, 'utf8')) as CapabilityConfig;

    expect(config.permissions).toEqual(
      expect.arrayContaining([
        'core:window:allow-minimize',
        'core:window:allow-toggle-maximize',
        'core:window:allow-is-maximized',
        'core:window:allow-close',
        'core:window:allow-start-dragging',
        'core:window:allow-set-always-on-top',
      ]),
    );
  });

  it('tracks native maximize state and swaps to the restore icon', () => {
    const source = readFileSync(new URL('./AppTitleBar.tsx', import.meta.url), 'utf8');
    expect(source).toContain('isMaximized()');
    expect(source).toContain('onResized');
    expect(source).toContain('Minimize2');
    expect(source).toMatch(/isWindowMaximized\s*\?\s*<Minimize2\s*\/>\s*:\s*<Maximize2\s*\/>/);
  });

  it('keeps host visibility before pane mode and theme, topmost, settings in order', () => {
    const source = readFileSync(new URL('./AppTitleBar.tsx', import.meta.url), 'utf8');
    expect(source.indexOf('onToggleHostPanel')).toBeLessThan(source.indexOf('onTogglePanels'));
    expect(source.indexOf('onToggleTheme')).toBeLessThan(source.indexOf('onToggleTopmost'));
    expect(source.indexOf('onToggleTopmost')).toBeLessThan(source.indexOf('onOpenSettings'));
  });

  it('leaves Android drawer gestures to the single app-shell controller', () => {
    const source = readFileSync(new URL('./AppTitleBar.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('handleTitlebarTouchStart');
    expect(source).not.toContain('mobileDrawerDragProgress');
    expect(source).not.toContain('onMobileHostDrawerDragProgress');
    expect(source).not.toContain('titlebar-mobile-drawer-button');
    expect(source).not.toContain('<Menu');
  });

  it('renders the configured vault state in the Android titlebar center', () => {
    const source = readFileSync(new URL('./AppTitleBar.tsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

    expect(source).toContain('vaultStatus: VaultSyncStatus | null');
    expect(source).toContain('titlebar-mobile-vault');
    expect(source).toContain('titlebar-mobile-vault-indicator');
    expect(source).toContain('titlebar-mobile-vault-indicator--active');
    expect(source).toContain('vaultStatus.lastSyncedAt');
    expect(source).toContain('vaultStatusLabelKey(vaultStatus)');
    expect(source).toContain('isVaultSyncing(vaultStatus)');
    expect(app).toContain('vaultStatus={vaultStatus}');
    expect(styles).toMatch(
      /html\.mobile-platform[\s\S]*?\.titlebar-mobile-vault\s*\{[^}]*display:\s*flex/s,
    );
    expect(styles).toMatch(
      /html\.mobile-platform[\s\S]*?\.status-meta\s*>\s*\.vault-status-meta\s*\{[^}]*display:\s*none/s,
    );
    expect(styles).toMatch(
      /\.titlebar-mobile-vault time\s*\{[^}]*font-size:\s*clamp\(10px,[^}]*11px\);[^}]*font-variant-numeric:\s*tabular-nums/s,
    );
    expect(styles).toMatch(
      /\.titlebar-mobile-vault-indicator--active\s*\{[^}]*background:\s*#32c875/s,
    );
  });

  it('locks the Android activity to portrait orientations', () => {
    const androidConfig = readFileSync(
      new URL('../../../src-tauri/tauri.android.conf.json', import.meta.url),
      'utf8',
    );
    const prepareScript = readFileSync(
      new URL('../../../scripts/prepare-android.mjs', import.meta.url),
      'utf8',
    );
    expect(androidConfig).toContain('bun run android:before-dev');
    expect(androidConfig).toContain('bun run android:before-build');
    expect(prepareScript).toContain('android:screenOrientation="sensorPortrait"');
    expect(prepareScript).toContain('android:name="\\.MainActivity"');
    expect(prepareScript).toContain('android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY');
  });
});
