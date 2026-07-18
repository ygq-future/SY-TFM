import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Columns2,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  RefreshCw,
  Rows2,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import type { AppearanceTheme } from '../../stores/settingsStore';

interface AppTitleBarProps {
  currentHost: RemoteHost | null;
  theme: AppearanceTheme;
  isDualPane: boolean;
  isHostPanelVisible: boolean;
  isTopmost: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onToggleHostPanel: () => void;
  onToggleTopmost: () => void;
  onTogglePanels: () => void;
  onOpenSettings: () => void;
}

/** 集合全局操作、外观控制与原生窗口按钮的超紧凑标题栏。 */
export function AppTitleBar({
  currentHost,
  theme,
  isDualPane,
  isHostPanelVisible,
  isTopmost,
  isRefreshing,
  onBack,
  onRefresh,
  onToggleTheme,
  onToggleHostPanel,
  onToggleTopmost,
  onTogglePanels,
  onOpenSettings,
}: AppTitleBarProps) {
  const { t } = useTranslation();
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | undefined;

    try {
      const appWindow = getCurrentWindow();
      const syncMaximizedState = async () => {
        const maximized = await appWindow.isMaximized();
        if (!disposed) setIsWindowMaximized(maximized);
      };

      void syncMaximizedState().catch(() => undefined);
      void appWindow
        .onResized(() => void syncMaximizedState().catch(() => undefined))
        .then((unlisten) => {
          if (disposed) unlisten();
          else stopListening = unlisten;
        })
        .catch(() => undefined);
    } catch {
      // Vite 浏览器预览没有 Tauri 窗口上下文。
    }

    return () => {
      disposed = true;
      stopListening?.();
    };
  }, []);
  const runWindowAction = (
    action: (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>,
  ) => {
    try {
      void action(getCurrentWindow()).catch((error: unknown) => {
        console.error('Native window action failed', error);
      });
    } catch {
      // Vite 浏览器预览没有 Tauri 窗口上下文。
    }
  };

  const handleDragStart = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    runWindowAction((appWindow) => appWindow.startDragging());
  };

  const toggleWindowMaximize = () => {
    runWindowAction(async (appWindow) => {
      await appWindow.toggleMaximize();
      setIsWindowMaximized(await appWindow.isMaximized());
    });
  };

  return (
    <header className="app-titlebar">
      <div className="titlebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <Sparkles />
        </div>
        <span className="brand-name">SY·TFM</span>
      </div>

      <div className="titlebar-operation-group">
        {currentHost && (
          <button type="button" title={t('titlebar.back')} onClick={onBack}>
            <ArrowLeft />
          </button>
        )}
        <button
          type="button"
          title={t('titlebar.refresh')}
          disabled={!currentHost}
          onClick={onRefresh}
        >
          <RefreshCw className={isRefreshing ? 'is-spinning' : ''} />
        </button>
        <span className="titlebar-separator" />
        <button
          type="button"
          title={t(isHostPanelVisible ? 'titlebar.hideHosts' : 'titlebar.showHosts')}
          onClick={onToggleHostPanel}
        >
          {isHostPanelVisible ? <PanelLeftClose /> : <PanelLeftOpen />}
        </button>
        <button
          type="button"
          title={t(isDualPane ? 'titlebar.singlePane' : 'titlebar.dualPane')}
          onClick={onTogglePanels}
        >
          {isDualPane ? <Rows2 /> : <Columns2 />}
        </button>
      </div>

      <div
        className="titlebar-drag-zone"
        onMouseDown={handleDragStart}
        onDoubleClick={toggleWindowMaximize}
      />

      <div className="titlebar-appearance-group">
        <button
          type="button"
          title={t(theme === 'light' ? 'titlebar.darkTheme' : 'titlebar.lightTheme')}
          onClick={onToggleTheme}
        >
          {theme === 'light' ? <Moon /> : <Sun />}
        </button>
        <button
          type="button"
          className={isTopmost ? 'titlebar-button--active' : undefined}
          title={t(isTopmost ? 'titlebar.unpin' : 'titlebar.pin')}
          aria-pressed={isTopmost}
          onClick={onToggleTopmost}
        >
          {isTopmost ? <Pin /> : <PinOff />}
        </button>
        <button type="button" title={t('titlebar.settings')} onClick={onOpenSettings}>
          <Settings />
        </button>
      </div>

      <div className="window-controls" aria-label={t('titlebar.windowControls')}>
        <button
          type="button"
          onClick={() => runWindowAction((appWindow) => appWindow.minimize())}
          aria-label={t('titlebar.minimize')}
        >
          <Minus />
        </button>
        <button
          type="button"
          onClick={toggleWindowMaximize}
          aria-label={t(isWindowMaximized ? 'titlebar.restore' : 'titlebar.maximize')}
        >
          {isWindowMaximized ? <Minimize2 /> : <Maximize2 />}
        </button>
        <button
          className="window-close"
          type="button"
          onClick={() => runWindowAction((appWindow) => appWindow.close())}
          aria-label={t('titlebar.close')}
        >
          <X />
        </button>
      </div>
    </header>
  );
}
