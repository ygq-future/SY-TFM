import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, LockKeyhole, X } from 'lucide-react';
import { ModalPortal } from '../../components/shared/ModalPortal';

/** 密码提示对话框（连接时密码为空则弹出）。 */
export function PasswordPromptDialog({
  hostName,
  onConfirm,
  onCancel,
}: {
  hostName: string;
  onConfirm: (password: string, remember: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password) onConfirm(password, remember);
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel compact-modal password-modal" role="dialog" aria-modal="true">
          <div className="modal-header">
            <div>
              <p className="modal-eyebrow">{t('password.eyebrow')}</p>
              <h3>{t('password.unlock', { name: hostName })}</h3>
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
          <p className="password-hint">
            <LockKeyhole />
            {t('password.secureHint')}
          </p>
          <form onSubmit={handleSubmit} className="compact-form password-form">
            <label className="field-label" htmlFor="host-password">
              {t('password.accessPassword')}
            </label>
            <div className="input-with-icon">
              <KeyRound />
              <input
                id="host-password"
                autoFocus
                type="password"
                className="field-control"
                placeholder={t('password.placeholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <label className="remember-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span className="custom-checkbox" />
              <span>
                <strong>{t('password.remember')}</strong>
                <small>{t('password.rememberHint')}</small>
              </span>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onCancel}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary-button" disabled={!password}>
                {t('password.connect')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
