import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type AriaRole,
} from 'react';
import { ModalPortal } from './ModalPortal';

/** 将下拉浮层锚定到触发器并挂载至 body，避开面板裁切与 transform 坐标系。 */
export function AnchoredPortal({
  anchorRef,
  className,
  role,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  className: string;
  role?: AriaRole;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const anchorBounds = anchor.getBoundingClientRect();
      const menuBounds = menu.getBoundingClientRect();
      const margin = 8;
      const gap = 5;
      const left = Math.max(
        margin,
        Math.min(anchorBounds.left, window.innerWidth - menuBounds.width - margin),
      );
      const below = anchorBounds.bottom + gap;
      const above = anchorBounds.top - menuBounds.height - gap;
      setPosition({
        left,
        top:
          below + menuBounds.height <= window.innerHeight - margin
            ? below
            : Math.max(margin, above),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [anchorRef, onClose]);

  return (
    <ModalPortal>
      <div ref={menuRef} className={className} role={role} style={position}>
        {children}
      </div>
    </ModalPortal>
  );
}
