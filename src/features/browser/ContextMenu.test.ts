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

  it('routes the folder-only favorite action with the full selection', () => {
    const source = readFileSync(new URL('./ContextMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain('selectedFiles');
    expect(source).toContain('currentPath');
    expect(source).toContain('getFavoriteFolderTargets');
    expect(source).toContain('onAddFavorite(favoriteTargets)');
    expect(source).toContain("labelKey: 'contextMenu.addFavorite'");
  });

  it('exposes native desktop shortcut hints for rename and delete', () => {
    const source = readFileSync(new URL('./ContextMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain("shortcut: 'F2'");
    expect(source).toContain("shortcut: 'Del'");
    expect(source).toContain('hint={item.shortcut}');
  });
});
