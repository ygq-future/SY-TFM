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
    expect(source).toContain('DragOverlay');
    expect(source).toContain('mobileActiveHostDrag');
    expect(source).toContain('event.active.rect.current.initial');
    expect(source).toContain('adjustScale={false}');
    expect(source).toContain('ModalPortal');
    expect(source).toMatch(/<ModalPortal>\s*<DragOverlay/);
    expect(source).toContain("classList.contains('mobile-platform')");
    expect(source).toContain('host-drag-overlay');
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

  it('uses delayed touch sorting without opening Android context menus', () => {
    expect(source).toContain('TouchSensor');
    expect(source).toContain('useSensor(TouchSensor');
    expect(source).toContain('useSensor(PlatformPointerSensor');
    expect(source).toContain("classList.contains('mobile-platform')");
    expect(css).toMatch(/html\.mobile-platform[\s\S]*?\.sidebar-host-actions[\s\S]*?opacity:\s*1/s);
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.host-filter-select \.select-value strong[^{]*\{[^}]*font-size:\s*14px/s,
    );
  });

  it('uses labelled mobile actions without duplicating the global drawer gesture', () => {
    expect(source).not.toContain('handleDrawerTouchMove');
    expect(source).not.toContain('mobileDrawerDragProgress');
    expect(source).not.toContain('onDrawerDragProgress');
    expect(source).not.toContain('onDrawerDragEnd');
    expect(source).toContain('sidebar-host-action-label');
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.sidebar-host-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.sidebar-host-actions button\s*\{[^}]*min-height:\s*42px/s,
    );
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.host-sidebar-list\s*\{[^}]*padding-bottom:\s*max\(/s,
    );
  });

  it('keeps the Windows host card cursor neutral', () => {
    expect(css).toMatch(/\.sidebar-host-row\s*\{[^}]*cursor:\s*default/s);
  });

  it('applies the configured glass opacity and blur to the Android drawer only', () => {
    expect(css).toMatch(
      /html\.mobile-platform[\s\S]*?\.host-sidebar,[\s\S]*?var\(--glass-opacity-percent\)[\s\S]*?backdrop-filter:\s*blur\(var\(--glass-blur\)\)/s,
    );
    const noBlurComment = css.indexOf('Android WebView scrolling should not continuously');
    const noBlurRule = css.slice(noBlurComment, css.indexOf('\n  }\n}', noBlurComment));
    expect(noBlurRule).not.toContain('.host-sidebar');
  });
});
