import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('overlay and host interaction policy', () => {
  it('does not close dialogs when the backdrop is clicked', () => {
    const modalFiles = [
      new URL('./Dialog.tsx', import.meta.url),
      new URL('../../features/connection/HostEditDialog.tsx', import.meta.url),
      new URL('../../features/connection/PasswordPromptDialog.tsx', import.meta.url),
    ];

    for (const file of modalFiles) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/className="modal-backdrop"\s+onClick=/);
    }
  });

  it('offers confirmed host deletion from hover actions and the host context menu', () => {
    const source = readFileSync(
      new URL('../../features/connection/HostList.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('onContextMenu=');
    expect(source).toContain("title={t('common.delete')}");
    expect(source).toContain('<HostContextMenu');
    expect(source).toContain('<ConfirmDialog');
  });
});
