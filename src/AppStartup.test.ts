import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop startup and Rust target configuration', () => {
  it('keeps the native window hidden until the first React frame is ready', () => {
    const config = readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8');
    const capability = readFileSync(
      new URL('../src-tauri/capabilities/default.json', import.meta.url),
      'utf8',
    );
    const entry = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
    expect(config).toMatch(/"visible"\s*:\s*false/);
    expect(capability).toContain('core:window:allow-show');
    expect(entry).toMatch(/getCurrentWindow\(\)[\s\S]*?\.show\(\)/);
    expect(entry).toContain('requestAnimationFrame');
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(app).toContain("import('./features/settings/SettingsDialog')");
  });

  it('uses distinct binary and library artifact names', () => {
    const cargo = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8');
    expect(cargo).toMatch(/\[lib\][\s\S]*?name\s*=\s*"sy_tfm_lib"/);
    expect(main).toContain('sy_tfm_lib::run()');
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
