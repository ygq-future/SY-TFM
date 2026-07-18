import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, PenLine, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

/** 确认对话框。 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel compact-modal" role="alertdialog" aria-modal="true">
          <div className="modal-header">
            <div>
              <p className="modal-eyebrow">{t('common.confirmation')}</p>
              <h3>{title}</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={onCancel}
              aria-label={t('common.close')}
            >
              <X />
            </button>
          </div>
          <div className={danger ? 'dialog-message dialog-message--danger' : 'dialog-message'}>
            {danger && <AlertTriangle />}
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onCancel}>
              {cancelLabel ?? t('common.cancel')}
            </button>
            <button
              className={danger ? 'danger-button' : 'primary-button'}
              type="button"
              onClick={onConfirm}
            >
              {confirmLabel ?? t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/** 单操作提示对话框。 */
export function AlertDialog({
  title,
  message,
  closeLabel,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel compact-modal" role="alertdialog" aria-modal="true">
          <div className="modal-header">
            <div>
              <p className="modal-eyebrow">{t('common.notice')}</p>
              <h3>{title}</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <X />
            </button>
          </div>
          <div className="dialog-message dialog-message--notice">
            <AlertCircle />
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
          <div className="modal-actions">
            <button className="primary-button" type="button" onClick={onClose}>
              {closeLabel ?? t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/** 输入对话框（用于重命名、新建文件夹/文件等）。 */
export function InputDialog({
  title,
  label,
  defaultValue = '',
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (value.trim()) onConfirm(value.trim());
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel compact-modal" role="dialog" aria-modal="true">
          <div className="modal-header">
            <div>
              <p className="modal-eyebrow">{t('common.quickAction')}</p>
              <h3>{title}</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={onCancel}
              aria-label={t('common.close')}
            >
              <X />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="compact-form">
            <label className="field-label" htmlFor="quick-action-value">
              {label}
            </label>
            <div className="input-with-icon">
              <PenLine />
              <input
                id="quick-action-value"
                autoFocus
                className="field-control"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCancel}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary-button">
                {confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
