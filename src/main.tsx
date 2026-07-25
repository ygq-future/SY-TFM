import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';

import i18n from './lib/i18n';
import { isMobilePlatform } from './lib/tauri';
import { useSettingsStore } from './stores/settingsStore';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error(i18n.t('errors.rootMissing'));
}
const appRoot = rootElement;

async function bootstrap() {
  try {
    if (await isMobilePlatform()) document.documentElement.classList.add('mobile-platform');
  } catch {
    // Vite 浏览器预览没有 Tauri IPC，保持桌面平台样式。
  }

  await useSettingsStore.getState().hydrateSettings();

  createRoot(appRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
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
