import { Toaster } from 'sonner';

/** Toast 通知系统（基于 sonner）。 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
