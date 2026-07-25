import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop startup and Rust target configuration', () => {
  it('shows the initially hidden native window without waiting for animation frames', () => {
    const config = readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8');
    const capability = readFileSync(
      new URL('../src-tauri/capabilities/default.json', import.meta.url),
      'utf8',
    );
    const entry = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
    expect(config).toMatch(/"visible"\s*:\s*false/);
    expect(capability).toContain('core:window:allow-show');
    expect(entry).toMatch(/getCurrentWindow\(\)[\s\S]*?\.show\(\)/);
    expect(entry).not.toContain('requestAnimationFrame');
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(app).toContain("import { SettingsDialog } from './features/settings/SettingsDialog'");
    expect(app).not.toContain("import('./features/settings/SettingsDialog')");
    expect(app).not.toContain('preloadSettingsDialog');
  });

  it('hydrates platform typography before the first rendered frame', () => {
    const entry = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');

    expect(entry).toContain('useSettingsStore.getState().hydrateSettings()');
    expect(entry.indexOf('hydrateSettings()')).toBeLessThan(
      entry.indexOf('createRoot(appRoot).render'),
    );
  });

  it('uses distinct binary and library artifact names', () => {
    const cargo = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');
    expect(cargo).toMatch(/\[lib\][\s\S]*?name\s*=\s*"sy_tfm_lib"/);
    expect(main).toContain('sy_tfm_lib::run()');
  });

  it('builds production executables with Tauri custom protocol assets', () => {
    const cargo = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
    const portableBuild = readFileSync(
      new URL('../scripts/build-portable.ps1', import.meta.url),
      'utf8',
    );
    expect(cargo).toMatch(/custom-protocol\s*=\s*\["tauri\/custom-protocol"\]/);
    expect(cargo).toMatch(/default\s*=\s*\[[^\]]*"custom-protocol"/);
    expect(portableBuild).toContain('bun run tauri build -- --no-bundle');
    expect(portableBuild).not.toContain('cargo build --release');
  });

  it('registers the desktop single-instance guard before every other plugin', () => {
    const cargo = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
    const backend = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8');
    expect(cargo).toContain('tauri-plugin-single-instance');
    expect(backend).toContain('tauri_plugin_single_instance::init');
    expect(backend).toContain('window.unminimize()');
    expect(backend).toContain('window.show()');
    expect(backend).toContain('window.set_focus()');
    expect(backend.indexOf('tauri_plugin_single_instance::init')).toBeLessThan(
      backend.indexOf('tauri_plugin_dialog::init'),
    );
  });

  it('does not panic on recoverable production download states', () => {
    const localFs = readFileSync(new URL('../src-tauri/src/local_fs.rs', import.meta.url), 'utf8')
      .split('#[cfg(test)]')[0]
      .replace(/unwrap_or(?:_else)?/g, '');
    const sftp = readFileSync(
      new URL('../src-tauri/src/transport/sftp_adapter.rs', import.meta.url),
      'utf8',
    ).split('    #[cfg(test)]')[0];
    expect(localFs).not.toMatch(/\.expect\(|\.unwrap\(/);
    expect(sftp).not.toMatch(/\.expect\(|\.unwrap\(/);
  });
});
