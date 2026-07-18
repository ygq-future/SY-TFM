import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('global modal mounting', () => {
  it('keeps every application dialog outside transformed workspace panels', () => {
    const modalFiles = [
      new URL('./Dialog.tsx', import.meta.url),
      new URL('../../features/connection/HostEditDialog.tsx', import.meta.url),
      new URL('../../features/connection/PasswordPromptDialog.tsx', import.meta.url),
    ];

    for (const file of modalFiles) {
      expect(readFileSync(file, 'utf8')).toContain('<ModalPortal>');
    }
  });

  it('mounts path dropdowns through the shared anchored portal', () => {
    const dropdownFiles = [
      new URL('../../features/browser/Breadcrumb.tsx', import.meta.url),
      new URL('../../features/browser/PaneHostSelect.tsx', import.meta.url),
    ];
    for (const file of dropdownFiles) {
      expect(readFileSync(file, 'utf8')).toContain('<AnchoredPortal');
    }
    expect(readFileSync(new URL('./AnchoredPortal.tsx', import.meta.url), 'utf8')).toContain(
      '<ModalPortal>',
    );
  });
});
