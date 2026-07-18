import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';

/** 本地文件拖入提示层；传输状态统一交由底部状态栏展示。 */
export function UploadZone({
  isNativeDragging = false,
  onFilesDropped,
}: {
  isNativeDragging?: boolean;
  onFilesDropped: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const show = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) setIsDragging(true);
    };
    const hide = () => setIsDragging(false);
    window.addEventListener('dragenter', show);
    window.addEventListener('drop', hide);
    window.addEventListener('dragend', hide);
    return () => {
      window.removeEventListener('dragenter', show);
      window.removeEventListener('drop', hide);
      window.removeEventListener('dragend', hide);
    };
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFilesDropped(files);
    },
    [onFilesDropped],
  );

  return (
    <div
      className={cn(
        'upload-zone',
        isDragging || isNativeDragging
          ? 'pointer-events-auto opacity-100'
          : 'pointer-events-none opacity-0',
      )}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
      }}
    >
      <div className="upload-drop-card">
        <span>
          <UploadCloud />
        </span>
        <strong>{t('browser.dropUpload')}</strong>
        <p>{t('browser.dropUploadHint')}</p>
      </div>
    </div>
  );
}
