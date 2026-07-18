import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** 将全局浮层挂载到 document.body，避免被局部面板裁切或建立新的定位上下文。 */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
}
