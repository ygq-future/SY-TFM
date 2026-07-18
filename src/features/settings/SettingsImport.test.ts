import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('settings import synchronization', () => {
  it('reloads both appearance settings and the host list after import', () => {
    const source = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Promise.all([settings.hydrateSettings(), loadHosts()])');
  });

  it('shows resolved platform paths and keeps the background as an editable path', () => {
    const source = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    expect(source).toContain('getStoragePaths()');
    expect(source).toContain('backgroundPathDraft');
    expect(source).toContain('pickImageFile');
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    expect(commands).toContain('pub fn load_background_image');
    expect(commands).toContain('metadata.len() > 20 * 1024 * 1024');
  });

  it('keeps the saved background path while allowing the image to be disabled', () => {
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const store = readFileSync(new URL('../../stores/settingsStore.ts', import.meta.url), 'utf8');
    expect(dialog).toContain('setBackgroundImageEnabled');
    expect(store).toContain('backgroundImageEnabled');
  });

  it('exposes every typography role and the complete glass opacity range', () => {
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const store = readFileSync(new URL('../../stores/settingsStore.ts', import.meta.url), 'utf8');
    for (const role of [
      'fontSize',
      'headingFontSize',
      'labelFontSize',
      'captionFontSize',
      'dataFontSize',
    ]) {
      expect(dialog).toContain(`settings.${role}`);
      expect(store).toContain(role);
    }
    expect(dialog).toMatch(/value=\{settings\.glassOpacity\}[\s\S]*?min=\{0\}[\s\S]*?max=\{1\}/);
    expect(store).toContain('Math.min(1, Math.max(0, glassOpacity))');
  });

  it('keeps the light settings surface distinct and removes the nav checkmark', () => {
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(dialog).not.toContain('{section === item.value && <Check />}');
    expect(css).toMatch(/html\[data-theme='light'\] \.settings-panel\s*\{/);
  });

  it('opens the canonical project URL through the system browser plugin', () => {
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const backend = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const tauri = readFileSync(new URL('../../../src-tauri/src/lib.rs', import.meta.url), 'utf8');
    expect(dialog).toContain("from '@tauri-apps/plugin-opener'");
    expect(dialog).toContain('openUrl(projectUrl)');
    expect(backend).toContain('https://github.com/ygq-future/SY-TFM');
    expect(backend).not.toContain('https://github.com/ygq-future/SY-TFM.git');
    expect(tauri).toContain('tauri_plugin_opener::init()');
  });
});
