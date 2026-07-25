import { describe, expect, it } from 'vitest';
import {
  MOBILE_FILE_DRAG_GAP,
  hasHorizontalSwipe,
  mobileDrawerDragProgress,
  mobileDrawerTranslate,
  mobileFileDragRect,
  rectangleOverlapRatio,
  settleMobileDrawer,
} from './dragSensors';

describe('Android file drag geometry', () => {
  it('uses the complete upper-left preview rectangle as the drop target', () => {
    const rect = mobileFileDragRect({ x: 240, y: 400 }, 120, 30);

    expect(rect).toEqual({
      left: 240 - MOBILE_FILE_DRAG_GAP - 120,
      top: 400 - MOBILE_FILE_DRAG_GAP - 30,
      right: 240 - MOBILE_FILE_DRAG_GAP,
      bottom: 400 - MOBILE_FILE_DRAG_GAP,
      width: 120,
      height: 30,
    });
    expect(rect.right).toBeLessThan(240);
    expect(rect.bottom).toBeLessThan(400);
  });

  it('requires at least half of the floating item to overlap a directory', () => {
    const preview = { left: 0, top: 15, right: 120, bottom: 45, width: 120, height: 30 };

    expect(
      rectangleOverlapRatio(preview, {
        left: 0,
        top: 0,
        right: 320,
        bottom: 30,
        width: 320,
        height: 30,
      }),
    ).toBe(0.5);
    expect(
      rectangleOverlapRatio(
        { ...preview, top: 16, bottom: 46 },
        { left: 0, top: 0, right: 320, bottom: 30, width: 320, height: 30 },
      ),
    ).toBeLessThan(0.5);
  });

  it('recognizes deliberate horizontal drawer swipes without accepting vertical scrolling', () => {
    expect(hasHorizontalSwipe({ x: 20, y: 30 }, { x: 96, y: 42 }, 'right')).toBe(true);
    expect(hasHorizontalSwipe({ x: 180, y: 30 }, { x: 100, y: 38 }, 'left')).toBe(true);
    expect(hasHorizontalSwipe({ x: 20, y: 30 }, { x: 55, y: 120 }, 'right')).toBe(false);
  });

  it('maps drawer movement to live progress and settles in the drag direction', () => {
    expect(mobileDrawerDragProgress(20, 120, 400, false)).toBe(0.25);
    expect(mobileDrawerDragProgress(220, 120, 400, true)).toBe(0.75);
    expect(mobileDrawerDragProgress(20, 620, 400, false)).toBe(1);
    expect(settleMobileDrawer(0.3, 72)).toBe(true);
    expect(settleMobileDrawer(0.7, -72)).toBe(false);
    expect(settleMobileDrawer(0.49, 20)).toBe(false);
    expect(settleMobileDrawer(0.51, -20)).toBe(true);
  });

  it('moves the closing drawer beyond its left workspace inset', () => {
    expect(mobileDrawerTranslate(0)).toBe('calc(-100% - 8px)');
    expect(mobileDrawerTranslate(0.5)).toBe('calc(-50% - 4px)');
    expect(mobileDrawerTranslate(1)).toBe('calc(0% - 0px)');
  });
});
