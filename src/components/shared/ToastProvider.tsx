import { Toaster } from 'sonner';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';

/** Toast 通知系统（基于 sonner）。 */
export function ToastProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const theme = useSettingsStore((state) => state.theme);
  return (
    <>
      {children}
      <Toaster
        theme={theme}
        className="app-toaster"
        position="bottom-right"
        closeButton
        containerAriaLabel={t('common.notifications')}
        gap={8}
        toastOptions={{
          closeButtonAriaLabel: t('common.closeNotification'),
          duration: 4000,
          style: {
            border: '1px solid var(--line)',
            borderRadius: '14px',
            background: 'var(--modal-surface)',
            color: 'var(--app-ink)',
            boxShadow: 'var(--shadow-soft)',
            fontSize: 'var(--type-body-size, 13px)',
            backdropFilter: 'blur(var(--glass-blur, 22px)) saturate(1.25)',
          },
          className: 'app-toast',
        }}
      />
    </>
  );
}
