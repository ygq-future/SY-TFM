import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Pause,
  Play,
  PlugZap,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  enableVaultSync,
  pauseVaultSync,
  restoreVaultFromWebDav,
  resumeVaultSync,
  syncVaultNow,
  testVaultWebDav,
} from '../../lib/tauri';
import { hasAppErrorCode } from '../../lib/errors';
import { useVaultSyncStore } from '../../stores/vaultSyncStore';
import { ConfirmDialog } from '../../components/shared/Dialog';

/** WebDAV 跨设备加密保险库设置卡片。 */
export function VaultSyncPanel({
  backupPassword,
  confirmPassword,
  onSecretsSaved,
  onRestored,
}: {
  backupPassword: string;
  confirmPassword: string;
  onSecretsSaved: () => void;
  onRestored: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { status, setStatus, refreshStatus } = useVaultSyncStore();
  const [webdavUrl, setWebdavUrl] = useState('');
  const [username, setUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [isCloudOverwritePending, setIsCloudOverwritePending] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!status) return;
    setWebdavUrl(status.webdavUrl);
    setUsername(status.username);
  }, [status]);

  const credentials = { webdavUrl, username, password: webdavPassword };
  const clearSecrets = () => {
    setWebdavPassword('');
    onSecretsSaved();
  };

  const localizedVaultError = (error: unknown): string => {
    if (hasAppErrorCode(error, 'auth_failed')) {
      return t('settings.storage.vaultErrorCredentials');
    }
    if (
      hasAppErrorCode(error, 'connection_failed') ||
      hasAppErrorCode(error, 'connection_timeout') ||
      hasAppErrorCode(error, 'host_unreachable') ||
      hasAppErrorCode(error, 'protocol_error') ||
      hasAppErrorCode(error, 'operation_timeout')
    ) {
      return t('settings.storage.vaultErrorConnection');
    }
    if (hasAppErrorCode(error, 'permission_denied')) {
      return t('settings.storage.vaultErrorPermission');
    }
    if (hasAppErrorCode(error, 'file_not_found')) {
      return t('settings.storage.vaultErrorNotFound');
    }
    if (hasAppErrorCode(error, 'vault_locked')) {
      return t('settings.storage.vaultErrorLocked');
    }
    if (hasAppErrorCode(error, 'sync_conflict')) {
      return t('settings.storage.vaultErrorConflict');
    }
    if (
      hasAppErrorCode(error, 'invalid_backup') ||
      hasAppErrorCode(error, 'crypto_decrypt_failed')
    ) {
      return t('settings.storage.vaultErrorInvalidBackup');
    }
    if (
      hasAppErrorCode(error, 'storage_read_failed') ||
      hasAppErrorCode(error, 'storage_write_failed') ||
      hasAppErrorCode(error, 'crypto_encrypt_failed')
    ) {
      return t('settings.storage.vaultErrorStorage');
    }
    return t('settings.storage.vaultErrorUnknown');
  };

  const validateCredentials = (): boolean => {
    if (!webdavUrl.trim()) {
      toast.error(t('settings.storage.vaultRequiredWebDavUrl'));
      return false;
    }
    if (!username.trim()) {
      toast.error(t('settings.storage.vaultRequiredUsername'));
      return false;
    }
    if (!webdavPassword && !status?.passwordSaved) {
      toast.error(t('settings.storage.vaultRequiredWebDavPassword'));
      return false;
    }
    return true;
  };

  const validateBackupPassword = (required: boolean): boolean => {
    if (required && !backupPassword && !status?.backupPasswordSaved) {
      toast.error(t('settings.storage.vaultRequiredBackupPassword'));
      return false;
    }
    if (backupPassword && backupPassword !== confirmPassword) {
      toast.error(t('settings.storage.vaultPasswordMismatch'));
      return false;
    }
    return true;
  };

  const performEnable = async (overwriteExisting: boolean) => {
    setBusy(true);
    try {
      const next = status?.vaultInitialized
        ? await resumeVaultSync()
        : await enableVaultSync(credentials, backupPassword || undefined, overwriteExisting);
      setStatus(next);
      clearSecrets();
      toast.success(
        t(
          status?.vaultInitialized
            ? 'settings.storage.vaultResumed'
            : 'settings.storage.vaultEnabled',
        ),
      );
    } catch (error) {
      if (
        !overwriteExisting &&
        !status?.vaultInitialized &&
        hasAppErrorCode(error, 'sync_conflict')
      ) {
        setIsCloudOverwritePending(true);
        return;
      }
      toast.error(t('settings.storage.vaultEnableFailed', { error: localizedVaultError(error) }));
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    if (!status?.vaultInitialized && (!validateCredentials() || !validateBackupPassword(true)))
      return;
    await performEnable(false);
  };

  const testConnection = async () => {
    if (!validateCredentials() || !validateBackupPassword(false)) return;
    setBusy(true);
    try {
      const next = await testVaultWebDav(credentials, backupPassword || undefined);
      setStatus(next);
      clearSecrets();
      toast.success(t('settings.storage.vaultTestSuccess'));
    } catch (error) {
      toast.error(t('settings.storage.vaultTestFailed', { error: localizedVaultError(error) }));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!validateCredentials() || !validateBackupPassword(true)) return;
    setBusy(true);
    try {
      await restoreVaultFromWebDav(credentials, backupPassword || undefined);
      await refreshStatus();
      clearSecrets();
      await onRestored();
      toast.success(t('settings.storage.vaultRestored'));
    } catch (error) {
      toast.error(t('settings.storage.vaultRestoreFailed', { error: localizedVaultError(error) }));
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    if (!validateBackupPassword(false)) return;
    setBusy(true);
    try {
      const next = await syncVaultNow(backupPassword || undefined);
      setStatus(next);
      onSecretsSaved();
      toast.success(t('settings.storage.vaultSynced'));
    } catch (error) {
      toast.error(t('settings.storage.vaultSyncFailed', { error: localizedVaultError(error) }));
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    setBusy(true);
    try {
      const next = await pauseVaultSync();
      setStatus(next);
      toast.success(t('settings.storage.vaultPaused'));
    } catch (error) {
      toast.error(t('settings.storage.vaultPauseFailed', { error: localizedVaultError(error) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="vault-sync-card">
        <div className="vault-card-heading">
          <span className="setting-icon">
            <Cloud />
          </span>
          <div>
            <strong>{t('settings.storage.vaultTitle')}</strong>
            <p>{t('settings.storage.vaultHint')}</p>
          </div>
          <span className={status?.enabled ? 'vault-state vault-state--active' : 'vault-state'}>
            {status?.enabled
              ? t('settings.storage.vaultActive')
              : status?.vaultInitialized
                ? t('settings.storage.vaultPausedState')
                : status?.configured
                  ? t('settings.storage.vaultSavedState')
                  : t('settings.storage.vaultInactive')}
          </span>
        </div>

        {status?.enabled ? (
          <>
            <dl className="vault-summary">
              <div>
                <dt>{t('settings.storage.vaultServer')}</dt>
                <dd>{status.webdavUrl}</dd>
              </div>
              <div>
                <dt>{t('settings.storage.vaultRemotePath')}</dt>
                <dd>{status.remotePath}</dd>
              </div>
              <div>
                <dt>{t('settings.storage.vaultRevision')}</dt>
                <dd>{Number(status.revision)}</dd>
              </div>
              <div>
                <dt>{t('settings.storage.vaultLastSync')}</dt>
                <dd>
                  {status.lastSyncedAt
                    ? new Date(status.lastSyncedAt).toLocaleString()
                    : t('settings.storage.vaultNever')}
                </dd>
              </div>
            </dl>
            <div className="settings-button-row vault-actions">
              <button type="button" className="primary-button" disabled={busy} onClick={sync}>
                <RefreshCw className={busy ? 'is-spinning' : undefined} />
                {t('settings.storage.vaultSyncNow')}
              </button>
              <button type="button" className="secondary-button" disabled={busy} onClick={pause}>
                <Pause />
                {t('settings.storage.vaultPause')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="vault-form-grid">
              <label className="vault-field vault-field--wide">
                <span>{t('settings.storage.vaultWebDavUrl')}</span>
                <input
                  value={webdavUrl}
                  onChange={(event) => setWebdavUrl(event.target.value)}
                  placeholder="https://cloud.example.com/dav"
                />
              </label>
              <label className="vault-field">
                <span>{t('settings.storage.vaultUsername')}</span>
                <input
                  value={username}
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label className="vault-field">
                <span>{t('settings.storage.vaultWebDavPassword')}</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={webdavPassword}
                  onChange={(event) => setWebdavPassword(event.target.value)}
                  placeholder={
                    status?.passwordSaved ? t('settings.storage.vaultSecretSaved') : undefined
                  }
                />
              </label>
            </div>
            <div className="vault-security-note">
              <ShieldCheck />
              <span>{t('settings.storage.vaultSecurityNote')}</span>
            </div>
            <div className="settings-button-row vault-actions">
              <button
                type="button"
                className="secondary-button vault-action-button"
                disabled={busy}
                onClick={testConnection}
              >
                <PlugZap />
                {t('settings.storage.vaultTest')}
              </button>
              <button
                type="button"
                className="primary-button vault-action-button"
                disabled={busy}
                onClick={enable}
              >
                {status?.vaultInitialized ? <Play /> : <CloudUpload />}
                {t(
                  status?.vaultInitialized
                    ? 'settings.storage.vaultResume'
                    : 'settings.storage.vaultEnable',
                )}
              </button>
              <button
                type="button"
                className="secondary-button vault-action-button"
                disabled={busy}
                onClick={restore}
              >
                <CloudDownload />
                {t('settings.storage.vaultRestore')}
              </button>
            </div>
          </>
        )}
      </div>
      {isCloudOverwritePending && (
        <ConfirmDialog
          title={t('settings.storage.vaultOverwriteTitle')}
          message={t('settings.storage.vaultOverwriteWarning')}
          confirmLabel={t('settings.storage.vaultOverwriteConfirm')}
          danger
          onConfirm={() => {
            setIsCloudOverwritePending(false);
            void performEnable(true);
          }}
          onCancel={() => setIsCloudOverwritePending(false)}
        />
      )}
    </>
  );
}
