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

  it('imports Android picker content URIs before persisting the background path', () => {
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const tauri = readFileSync(new URL('../../lib/tauri.ts', import.meta.url), 'utf8');
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const nativePlugin = readFileSync(
      new URL(
        '../../../src-tauri/plugins/android-storage/android/src/main/java/AndroidStoragePlugin.kt',
        import.meta.url,
      ),
      'utf8',
    );

    expect(dialog).toContain("selected.startsWith('content://')");
    expect(dialog).toContain('importBackgroundImage(selected)');
    expect(tauri).toContain("invoke<string>('import_background_image'");
    expect(commands).toContain('pub fn import_background_image');
    expect(nativePlugin).toContain('fun importImage(invoke: Invoke)');
    expect(nativePlugin).toContain('resolver.openInputStream(uri)');
    expect(dialog).not.toContain('{ error: formatAppError(error) }');
  });

  it('renders Android app-private backgrounds through binary IPC blob URLs', () => {
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const api = readFileSync(new URL('../../lib/tauri.ts', import.meta.url), 'utf8');
    const commands = readFileSync(
      new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
      'utf8',
    );
    const nativePlugin = readFileSync(
      new URL(
        '../../../src-tauri/plugins/android-storage/android/src/main/java/AndroidStoragePlugin.kt',
        import.meta.url,
      ),
      'utf8',
    );

    expect(app).toContain('loadBackgroundImageBytes(backgroundImage)');
    expect(app).toContain('URL.createObjectURL');
    expect(app).toContain('URL.revokeObjectURL');
    expect(app).toContain('Boolean(backgroundImageEnabled && backgroundImageSource)');
    expect(app).toContain('...(backgroundImageEnabled && backgroundImageSource');
    expect(app).toContain("classList.contains('mobile-platform')");
    expect(api).toContain("invoke<ArrayBuffer>('load_background_image_bytes'");
    expect(commands).toContain('pub fn load_background_image_bytes');
    expect(commands).toContain('tauri::ipc::Response::new(bytes)');
    expect(dialog).toContain('applyImportedAndroidBackground');
    expect(nativePlugin).toContain('activity.filesDir');
    expect(nativePlugin).toContain('MessageDigest.getInstance("SHA-256")');
    expect(nativePlugin).toContain('contentHash.take(16)');
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
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
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
    expect(dialog).toContain('settings-range-touch-guard');
    expect(dialog).toContain('MOBILE_RANGE_DIRECTION_THRESHOLD');
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.settings-range-touch-guard\s*\{[^}]*touch-action:\s*pan-y/s,
    );
  });

  it('exposes an Android-only app titlebar height setting', () => {
    const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
    const store = readFileSync(new URL('../../stores/settingsStore.ts', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

    expect(dialog).toContain('isAndroidPlatform && (');
    expect(dialog).toContain('settings.general.mobileTitlebarHeight');
    expect(dialog).toContain('value={settings.mobileTitlebarHeight}');
    expect(dialog).toContain('min={32}');
    expect(store).toContain('setMobileTitlebarHeight');
    expect(store).toContain('Math.max(32, Math.round(height))');
    expect(app).toContain("'--mobile-titlebar-content-height': `${mobileTitlebarHeight}px`");
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
