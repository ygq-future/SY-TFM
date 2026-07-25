let isOverlayPointerSequenceActive = false;

/** 标记当前指针序列已用于关闭弹层，避免同一次触摸继续驱动底层抽屉。 */
export function markAppOverlayPointerSequence(): void {
  if (typeof window === 'undefined') return;
  isOverlayPointerSequenceActive = true;
  const clear = () => {
    isOverlayPointerSequenceActive = false;
    window.removeEventListener('pointerup', clear, true);
    window.removeEventListener('pointercancel', clear, true);
  };
  window.addEventListener('pointerup', clear, true);
  window.addEventListener('pointercancel', clear, true);
}

/** 当前是否存在全局弹层，或当前指针序列是否已被弹层消费。 */
export function hasActiveAppOverlay(): boolean {
  return (
    isOverlayPointerSequenceActive ||
    (typeof document !== 'undefined' &&
      document.querySelector('[data-app-overlay="true"]') !== null)
  );
}
