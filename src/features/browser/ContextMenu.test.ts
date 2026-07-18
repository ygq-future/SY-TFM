import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('file context menu positioning', () => {
  it('renders through the global portal and measures its real dimensions', () => {
    const source = readFileSync(new URL('./ContextMenu.tsx', import.meta.url), 'utf8');

    expect(source).toContain("from '../../components/shared/ModalPortal'");
    expect(source).toContain('<ModalPortal>');
    expect(source).toContain('getBoundingClientRect()');
  });

  it('routes online and remote edit to real handlers', () => {
    const source = readFileSync(new URL('./ContextMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain('onRemoteEdit');
    expect(source).toContain('onOnlineEdit');
    expect(source).not.toContain('onUnavailable');
  });
});
