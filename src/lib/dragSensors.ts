import type { PointerEvent as ReactPointerEvent } from 'react';
import { PointerSensor } from '@dnd-kit/core';

interface DragCoordinates {
  x: number;
  y: number;
}

interface DragRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Android 目录落点至少需要覆盖浮动文件提示框的一半。 */
export const MOBILE_DIRECTORY_OVERLAP_THRESHOLD = 0.5;

const MOBILE_DRAWER_SWIPE_DISTANCE = 64;
const MOBILE_DRAWER_SWIPE_AXIS_RATIO = 1.25;
const MOBILE_DRAWER_EDGE_CLEARANCE = 8;

/** Android 文件拖动提示与触点之间的间距。 */
export const MOBILE_FILE_DRAG_GAP = 14;

/** 返回 Android 文件提示框在视口中的完整矩形，使提示框本体参与落点判定。 */
export function mobileFileDragRect(
  pointer: DragCoordinates,
  previewWidth: number,
  previewHeight: number,
): DragRect {
  const right = pointer.x - MOBILE_FILE_DRAG_GAP;
  const bottom = pointer.y - MOBILE_FILE_DRAG_GAP;
  return {
    left: right - previewWidth,
    top: bottom - previewHeight,
    right,
    bottom,
    width: previewWidth,
    height: previewHeight,
  };
}

/** 返回 source 矩形被 target 矩形覆盖的面积比例。 */
export function rectangleOverlapRatio(source: DragRect, target: DragRect): number {
  const overlapWidth = Math.max(
    0,
    Math.min(source.right, target.right) - Math.max(source.left, target.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(source.bottom, target.bottom) - Math.max(source.top, target.top),
  );
  const sourceArea = source.width * source.height;
  return sourceArea > 0 ? (overlapWidth * overlapHeight) / sourceArea : 0;
}

/** 判断一次触摸是否构成明确的水平抽屉手势。 */
export function hasHorizontalSwipe(
  start: DragCoordinates,
  end: DragCoordinates,
  direction: 'left' | 'right',
): boolean {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const directedDistance = direction === 'right' ? deltaX : -deltaX;
  return (
    directedDistance >= MOBILE_DRAWER_SWIPE_DISTANCE &&
    Math.abs(deltaX) >= Math.abs(deltaY) * MOBILE_DRAWER_SWIPE_AXIS_RATIO
  );
}

/** 将 Android 抽屉的水平位移映射为 0（关闭）到 1（完全打开）的实时进度。 */
export function mobileDrawerDragProgress(
  startX: number,
  currentX: number,
  drawerWidth: number,
  initiallyOpen: boolean,
): number {
  const width = Math.max(1, drawerWidth);
  const progress = (initiallyOpen ? 1 : 0) + (currentX - startX) / width;
  return Math.min(1, Math.max(0, progress));
}

/** 将抽屉进度转换为同时覆盖面板宽度和左侧外间距的水平位移。 */
export function mobileDrawerTranslate(progress: number): string {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  const closedRatio = 1 - normalizedProgress;
  return `calc(${(normalizedProgress - 1) * 100}% - ${closedRatio * MOBILE_DRAWER_EDGE_CLEARANCE}px)`;
}

/** 根据拖动方向与最终位置决定 Android 抽屉的停靠状态。 */
export function settleMobileDrawer(progress: number, deltaX: number): boolean {
  if (deltaX >= MOBILE_DRAWER_SWIPE_DISTANCE) return true;
  if (deltaX <= -MOBILE_DRAWER_SWIPE_DISTANCE) return false;
  return progress >= 0.5;
}

/** Android 触摸交给延迟 TouchSensor；其他平台保留原 PointerSensor 语义。 */
export class PlatformPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent): boolean => {
        if (
          event.pointerType === 'touch' &&
          document.documentElement.classList.contains('mobile-platform')
        ) {
          return false;
        }
        return event.isPrimary && event.button === 0;
      },
    },
  ];
}
