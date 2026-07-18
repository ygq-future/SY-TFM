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
});
