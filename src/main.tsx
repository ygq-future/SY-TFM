import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';

import i18n from './lib/i18n';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error(i18n.t('errors.rootMissing'));
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// 原生窗口先保持隐藏，待 React 与首屏样式完成两帧布局后再显示，避免启动白屏闪烁。
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    try {
      void getCurrentWindow()
        .show()
        .catch(() => undefined);
    } catch {
      // Vite 浏览器预览没有 Tauri 窗口上下文。
    }
  });
});
