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
import { markAppOverlayPointerSequence } from '../../lib/overlayInteraction';

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
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null);
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
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchorRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        markAppOverlayPointerSequence();
        onClose();
      }
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [anchorRef, onClose]);

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const origin = touchOriginRef.current;
    const touch = event.touches[0];
    if (!origin || !touch || !document.documentElement.classList.contains('mobile-platform')) {
      return;
    }
    if (Math.abs(touch.clientX - origin.x) > 8 || Math.abs(touch.clientY - origin.y) > 8) {
      touchOriginRef.current = null;
      onClose();
    }
  };

  return (
    <ModalPortal>
      <div
        ref={menuRef}
        className={className}
        role={role}
        style={position}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchOriginRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          touchOriginRef.current = null;
        }}
        onTouchCancel={() => {
          touchOriginRef.current = null;
        }}
      >
        {children}
      </div>
    </ModalPortal>
  );
}
