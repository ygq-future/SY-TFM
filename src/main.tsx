import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onBackButtonPress } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';

import i18n from './lib/i18n';
import { isMobilePlatform } from './lib/tauri';
import { shouldPreventMobileExit } from './lib/mobileExitGuard';
import { useSettingsStore } from './stores/settingsStore';
import App from './App';
import { EditorWindow } from './features/editor/EditorWindow';
import { isEditorWindow } from './features/editor/editorWindowLauncher';
import './index.css';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error(i18n.t('errors.rootMissing'));
}
const appRoot = rootElement;

async function bootstrap() {
  const editorWindow = isEditorWindow();
  if (editorWindow) document.documentElement.classList.add('editor-window');
  let mobilePlatform = false;
  try {
    mobilePlatform = await isMobilePlatform();
    if (mobilePlatform) document.documentElement.classList.add('mobile-platform');
  } catch {
    // Vite 浏览器预览没有 Tauri IPC，保持桌面平台样式。
  }

  if (mobilePlatform && !editorWindow) {
    try {
      let lastBackPressAt: number | null = null;
      await onBackButtonPress(() => {
        const currentTime = Date.now();
        if (shouldPreventMobileExit(lastBackPressAt, currentTime)) {
          lastBackPressAt = currentTime;
          window.dispatchEvent(new Event('mobile-back-confirmation-needed'));
        } else {
          lastBackPressAt = null;
          void getCurrentWindow()
            .destroy()
            .catch(() => undefined);
        }
      });
    } catch {
      // 浏览器预览或不支持关闭拦截的平台保持默认行为。
    }
  }

  await useSettingsStore.getState().hydrateSettings();
  if (editorWindow) {
    const settings = useSettingsStore.getState();
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.accent = settings.accentColor;
  }

  createRoot(appRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {editorWindow ? <EditorWindow /> : <App />}
      </QueryClientProvider>
    </StrictMode>,
  );

  // 隐藏窗口不会稳定派发 animation frame；React 挂载后应立即显示，避免启动死锁。
  try {
    await getCurrentWindow().show();
  } catch {
    // Vite 浏览器预览没有 Tauri 窗口上下文。
  }
}

void bootstrap();
