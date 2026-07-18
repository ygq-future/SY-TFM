import { renderToStaticMarkup } from 'react-dom/server';
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
});
