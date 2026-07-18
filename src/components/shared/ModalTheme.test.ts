import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('portaled modal theme tokens', () => {
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

  it('defines accent tokens on the document root for body portals', () => {
    expect(css).toContain("html[data-theme='light'][data-accent='violet']");
    expect(css).toContain("html[data-theme='dark'][data-accent='violet']");
  });

  it('keeps the secure connection hint compact and left aligned', () => {
    expect(css).toMatch(/\.password-hint\s*\{[^}]*justify-content:\s*flex-start;/s);
    expect(css).toMatch(/\.password-hint\s*\{[^}]*text-align:\s*left;/s);
    expect(css).toMatch(/\.password-hint\s*\{[^}]*align-items:\s*center;/s);
    expect(css).toMatch(/\.password-form\s*\{[^}]*margin-top:\s*12px;/s);
  });
});
