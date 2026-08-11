import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { flushVaultSync } from '../lib/tauri';

interface VaultCloseGuard {
  closeFailureVisible: boolean;
  cancelClose: () => void;
  forceClose: () => void;
}

/** 桌面关闭前冲刷持久化的 Vault 变化；移动端不注册窗口关闭监听。 */
export function useVaultCloseGuard(): VaultCloseGuard {
  const [closeFailureVisible, setCloseFailureVisible] = useState(false);
  const flushInProgressRef = useRef(false);

  const cancelClose = useCallback(() => setCloseFailureVisible(false), []);
  const forceClose = useCallback(() => {
    try {
      const appWindow = getCurrentWindow();
      setCloseFailureVisible(false);
      void appWindow.destroy().catch(() => setCloseFailureVisible(true));
    } catch {
      setCloseFailureVisible(true);
    }
  }, []);

  useEffect(() => {
    if (document.documentElement.classList.contains('mobile-platform')) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    try {
      const appWindow = getCurrentWindow();
      void appWindow
        .onCloseRequested(async (event) => {
          if (flushInProgressRef.current) {
            event.preventDefault();
            return;
          }
          flushInProgressRef.current = true;
          try {
            await flushVaultSync();
          } catch {
            event.preventDefault();
            if (active) setCloseFailureVisible(true);
          } finally {
            flushInProgressRef.current = false;
          }
        })
        .then((dispose) => {
          if (active) unlisten = dispose;
          else dispose();
        })
        .catch(() => undefined);
    } catch {
      // 浏览器预览没有 Tauri 窗口上下文。
    }
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return { closeFailureVisible, cancelClose, forceClose };
}
