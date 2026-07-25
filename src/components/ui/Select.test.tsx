import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('renders a reusable glass combobox without a native select', () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="连接协议"
        value="sftp"
        options={[
          { value: 'sftp', label: 'SFTP' },
          { value: 'webdav', label: 'WebDAV' },
        ]}
        onValueChange={vi.fn()}
      />,
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('select-trigger');
    expect(markup).not.toContain('<select');
  });

  it('maps primary and secondary option text to the shared typography tiers', () => {
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

    expect(css).toMatch(
      /\.select-value strong,[\s\S]*?\.select-option strong\s*\{[^}]*font-size:\s*var\(--type-body-size\)/s,
    );
    expect(css).toMatch(
      /\.select-value small,[\s\S]*?\.select-option small\s*\{[^}]*font-size:\s*var\(--type-caption-size\)/s,
    );
  });
});
