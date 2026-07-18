import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ToastProvider theme integration', () => {
  it('uses global theme tokens instead of a fixed white surface', () => {
    const source = readFileSync(new URL('./ToastProvider.tsx', import.meta.url), 'utf8');
    expect(source).toContain("background: 'var(--modal-surface)'");
    expect(source).toContain("color: 'var(--app-ink)'");
    expect(source).not.toContain('rgba(255, 255, 255, 0.97)');
  });
});
