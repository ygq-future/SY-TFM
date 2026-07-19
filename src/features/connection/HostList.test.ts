import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('host list ordering controls', () => {
  const source = readFileSync(new URL('./HostList.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

  it('uses the dnd-kit sortable preset for persistent host ordering', () => {
    expect(source).toContain('DndContext');
    expect(source).toContain('useSortable');
    expect(source).toContain('reorderHosts');
    expect(source).toContain('onDragEnd');
  });

  it('keeps the source card bounded and uses an explicit overlay plus target highlight', () => {
    expect(source).toContain("from '@dnd-kit/sortable'");
    expect(source).toContain('SortableContext');
    expect(source).toContain('useSortable');
    expect(source).toContain('verticalListSortingStrategy');
    expect(source).toContain('restrictToVerticalAxis');
    expect(source).toContain('CSS.Transform.toString(transform)');
    expect(source).toContain('autoScroll={false}');
    expect(source).not.toContain('DragOverlay');
    expect(source).not.toContain('dropIndicator');
    expect(css).toMatch(/\.host-sidebar-list\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).toContain('.sidebar-host-row--actions-suppressed');
    expect(source).toContain('suppressAllActions');
    expect(source).toContain('suppressedActionsHostId');
    expect(source).toContain('onPointerLeave');
    expect(source).toContain('setSuppressedActionsHostId(host.id)');
    expect(source).toContain("window.addEventListener('pointermove'");
    expect(css).toContain(
      '.sidebar-host-row:not(.sidebar-host-row--actions-suppressed):not(.sidebar-host-row--dragging):hover',
    );
    expect(css).not.toContain('.sidebar-host-row:focus-within .sidebar-host-actions');
  });

  it('keeps ordering exclusively on vertical drag without duplicate arrow controls', () => {
    const menu = readFileSync(new URL('./HostContextMenu.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('<ArrowUp');
    expect(source).not.toContain('<ArrowDown');
    expect(source).not.toContain('sidebar-host-order-actions');
    expect(menu).not.toContain('onMoveUp');
    expect(menu).not.toContain('onMoveDown');
  });
});
