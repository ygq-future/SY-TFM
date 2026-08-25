import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  FolderDown,
  FolderSearch,
  Globe2,
  KeyRound,
  LoaderCircle,
  Network,
  PlugZap,
  ServerCog,
  X,
} from 'lucide-react';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import type { Protocol } from '../../types/enums/Protocol';
import type { HttpScheme } from '../../types/enums/HttpScheme';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConfirmDialog } from '../../components/shared/Dialog';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { Select, type SelectOption } from '../../components/ui/Select';
import { pickDirectory } from '../../lib/dialog';
import { testHostConnection } from '../../lib/tauri';
import { formatAppError, getHostKeyUnknownDetails } from '../../lib/errors';

/** 新建/编辑主机对话框。 */
export function HostEditDialog({
  host,
  onClose,
}: {
  host: RemoteHost | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { addHost, updateHost } = useConnectionStore();
  const protocolOptions: SelectOption<Protocol>[] = [
    { value: 'sftp', label: 'SFTP', description: t('hostEditor.sftpDescription') },
    { value: 'webdav', label: 'WebDAV', description: t('hostEditor.webdavDescription') },
  ];
  const isEdit = host !== null;
  const hasSavedPassword = Boolean(host?.password);
  const [clearPassword, setClearPassword] = useState(false);
  const [testState, setTestState] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [pendingHostKey, setPendingHostKey] = useState<{
    host: RemoteHost;
    password?: string;
    fingerprint: string;
    endpoint: string;
  } | null>(null);
  const [form, setForm] = useState<RemoteHost>(
    host
      ? { ...host, password: '' }
      : {
          id: '',
          name: '',
          protocol: 'sftp',
          host: '',
          port: 22,
          username: 'anonymous',
          password: '',
          tags: '',
          favoriteFolders: [],
          downloadPath: null,
          https: true,
          basePath: null,
          sftpHostKeyFingerprint: null,
        },
  );

  const updateForm = (patch: Partial<RemoteHost>) => {
    setTestState({ status: 'idle', message: '' });
    setForm((current) => updateHostForm(current, patch));
  };

  const testConnection = async (testHost: RemoteHost, password?: string) => {
    await testHostConnection(testHost, password);
    setTestState({ status: 'success', message: t('hostEditor.testSuccess') });
  };

  const handleTestConnection = async () => {
    setTestState({ status: 'testing', message: t('hostEditor.testing') });
    const password = form.password || undefined;
    const testHost: RemoteHost = {
      ...normalizeHostForm(form),
      id: form.id || crypto.randomUUID(),
      password: '',
    };
    try {
      await testConnection(testHost, password);
    } catch (error) {
      const details = getHostKeyUnknownDetails(error);
      if (details) {
        setTestState({ status: 'idle', message: '' });
        setPendingHostKey({
          host: testHost,
          password,
          fingerprint: details.actualFingerprint,
          endpoint: `${details.host}:${details.port}`,
        });
        return;
      }
      setTestState({
        status: 'error',
        message: t('hostEditor.testFailed', { error: formatAppError(error) }),
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedForm = normalizeHostForm(form);
    if (isEdit && host) await updateHost(normalizedForm, clearPassword);
    else await addHost({ ...normalizedForm, id: crypto.randomUUID() });
    onClose();
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel host-editor" role="dialog" aria-modal="true">
          <div className="host-editor-intro">
            <div className="editor-icon">
              <ServerCog />
            </div>
            <div>
              <p className="modal-eyebrow">{t('hostEditor.eyebrow')}</p>
              <h3>{t(isEdit ? 'hostEditor.editTitle' : 'hostEditor.newTitle')}</h3>
              <p>{t('hostEditor.description')}</p>
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

          <form onSubmit={handleSubmit} className="host-editor-form">
            <div className="host-editor-scroll">
              <div className="protocol-picker">
                <span className="field-label protocol-picker-label">
                  {t('hostEditor.protocol')}
                </span>
                <Select
                  ariaLabel={t('hostEditor.protocol')}
                  id="host-protocol"
                  className="protocol-select"
                  icon={<Network />}
                  value={form.protocol}
                  options={protocolOptions}
                  onValueChange={(protocol) => {
                    updateForm({
                      protocol,
                      port: protocol === 'webdav' ? 0 : defaultPortFor(protocol),
                    });
                  }}
                />
              </div>

              <div className="form-grid">
                <Field label={t('hostEditor.spaceName')} className="field-name">
                  <input
                    className="field-control"
                    value={form.name}
                    onChange={(event) => updateForm({ name: event.target.value })}
                    placeholder={t('hostEditor.spacePlaceholder')}
                    required
                  />
                </Field>
                <Field label={t('hostEditor.tags')} className="field-tags">
                  <input
                    className="field-control"
                    value={form.tags}
                    onChange={(event) => updateForm({ tags: event.target.value })}
                    placeholder={t('hostEditor.tagsPlaceholder')}
                  />
                </Field>
                {form.protocol === 'webdav' ? (
                  <>
                    <Field label={t('hostEditor.webdavUrl')} className="field-webdav-url">
                      <div className="input-with-icon">
                        <Globe2 />
                        <input
                          className="field-control"
                          value={form.host}
                          onChange={(event) => updateForm({ host: event.target.value })}
                          onBlur={() => {
                            const normalized = normalizeWebDavAddress(form.host, form.https);
                            updateForm(normalized);
                          }}
                          placeholder={t('hostEditor.webdavUrlPlaceholder')}
                          required
                        />
                      </div>
                    </Field>
                    <Field label={t('hostEditor.httpScheme')} className="field-webdav-scheme">
                      <Select<HttpScheme>
                        ariaLabel={t('hostEditor.httpScheme')}
                        className="scheme-select"
                        value={form.https ? 'https' : 'http'}
                        options={[
                          { value: 'https', label: 'HTTPS' },
                          { value: 'http', label: 'HTTP' },
                        ]}
                        onValueChange={(scheme) => updateForm({ https: scheme === 'https' })}
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label={t('hostEditor.host')} className="field-host">
                      <input
                        className="field-control"
                        value={form.host}
                        onChange={(event) => updateForm({ host: event.target.value })}
                        placeholder={t('hostEditor.hostPlaceholder')}
                        required
                      />
                    </Field>
                    <Field label={t('hostEditor.port')} className="field-port">
                      <input
                        type="number"
                        className="field-control"
                        value={form.port}
                        onChange={(event) => updateForm({ port: Number(event.target.value) })}
                        required
                      />
                    </Field>
                  </>
                )}
                <Field label={t('hostEditor.username')} className="field-username">
                  <input
                    id="host-username"
                    name="username"
                    autoComplete="username"
                    className="field-control"
                    value={form.username}
                    onChange={(event) => updateForm({ username: event.target.value })}
                    required
                  />
                </Field>
                <Field label={t('hostEditor.password')} className="field-password">
                  <div className="input-with-icon">
                    <KeyRound />
                    <input
                      id="host-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      className="field-control"
                      value={form.password}
                      placeholder={t(
                        hasSavedPassword
                          ? 'hostEditor.keepPassword'
                          : 'hostEditor.passwordPlaceholder',
                      )}
                      onChange={(event) => {
                        setClearPassword(false);
                        updateForm({ password: event.target.value });
                      }}
                    />
                  </div>
                  {isEdit && hasSavedPassword && (
                    <div className="saved-password-row">
                      <span className="saved-password-status">
                        {t(
                          clearPassword ? 'hostEditor.clearAfterSave' : 'hostEditor.passwordSaved',
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          updateForm({ password: '' });
                          setClearPassword((clear) => !clear);
                        }}
                      >
                        {t(clearPassword ? 'hostEditor.undoClear' : 'hostEditor.clearSaved')}
                      </button>
                    </div>
                  )}
                </Field>
                {form.protocol === 'sftp' && form.sftpHostKeyFingerprint && (
                  <Field label={t('hostEditor.trustedFingerprint')} className="field-fingerprint">
                    <div className="trusted-fingerprint-row">
                      <code>{form.sftpHostKeyFingerprint}</code>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => updateForm({ sftpHostKeyFingerprint: null })}
                      >
                        {t('hostEditor.forgetFingerprint')}
                      </button>
                    </div>
                  </Field>
                )}
                <Field label={t('hostEditor.downloadPath')} className="field-download">
                  <div className="input-with-icon input-with-action">
                    <FolderDown />
                    <input
                      className="field-control"
                      value={form.downloadPath ?? ''}
                      onChange={(event) => updateForm({ downloadPath: event.target.value || null })}
                      placeholder={t('hostEditor.downloadPlaceholder')}
                    />
                    <button
                      type="button"
                      className="field-browse-button"
                      title={t('hostEditor.selectDownload')}
                      aria-label={t('hostEditor.selectDownload')}
                      onClick={() => {
                        void pickDirectory(
                          t('settings.storage.chooseDownload'),
                          form.downloadPath ?? undefined,
                        ).then((path) => {
                          if (path) updateForm({ downloadPath: path });
                        });
                      }}
                    >
                      <FolderSearch />
                    </button>
                  </div>
                </Field>
                {form.protocol === 'webdav' && (
                  <>
                    <Field label={t('hostEditor.basePath')} className="field-base-path">
                      <input
                        className="field-control"
                        value={form.basePath ?? ''}
                        onChange={(event) => updateForm({ basePath: event.target.value || null })}
                        placeholder={t('hostEditor.basePathPlaceholder')}
                      />
                    </Field>
                  </>
                )}
              </div>
            </div>

            <div className="modal-actions host-editor-actions">
              <div className={`host-test-state host-test-state--${testState.status}`}>
                <button
                  type="button"
                  className="secondary-button host-test-button"
                  disabled={testState.status === 'testing' || !form.host.trim()}
                  onClick={() => void handleTestConnection()}
                >
                  {testState.status === 'testing' ? (
                    <LoaderCircle className="is-spinning" />
                  ) : testState.status === 'success' ? (
                    <CheckCircle2 />
                  ) : (
                    <PlugZap />
                  )}
                  {t('hostEditor.testConnection')}
                </button>
                {testState.message && (
                  <span>
                    {testState.status === 'error' && <AlertCircle />}
                    {testState.message}
                  </span>
                )}
              </div>
              <div className="host-editor-submit-actions">
                <button type="button" className="secondary-button" onClick={onClose}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="primary-button">
                  {t(isEdit ? 'hostEditor.save' : 'hostEditor.create')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {pendingHostKey && (
        <ConfirmDialog
          title={t('hostKey.trustTitle')}
          message={
            <div className="host-key-message">
              <p>{t('hostKey.trustMessage', { endpoint: pendingHostKey.endpoint })}</p>
              <code>{pendingHostKey.fingerprint}</code>
            </div>
          }
          confirmLabel={t('hostKey.trust')}
          onConfirm={() => {
            const pending = pendingHostKey;
            setPendingHostKey(null);
            const trustedHost = {
              ...pending.host,
              sftpHostKeyFingerprint: pending.fingerprint,
            };
            setForm((current) => ({
              ...current,
              sftpHostKeyFingerprint: pending.fingerprint,
            }));
            setTestState({ status: 'testing', message: t('hostEditor.testing') });
            void testConnection(trustedHost, pending.password).catch((error: unknown) => {
              setTestState({
                status: 'error',
                message: t('hostEditor.testFailed', { error: formatAppError(error) }),
              });
            });
          }}
          onCancel={() => setPendingHostKey(null)}
        />
      )}
    </ModalPortal>
  );
}

export function normalizeHostForm(form: RemoteHost): RemoteHost {
  return form.protocol === 'webdav'
    ? {
        ...form,
        ...normalizeWebDavAddress(form.host, form.https),
        port: 0,
        sftpHostKeyFingerprint: null,
      }
    : form;
}

export function updateHostForm(current: RemoteHost, patch: Partial<RemoteHost>): RemoteHost {
  const next = { ...current, ...patch };
  const identityChanged =
    (patch.host !== undefined && patch.host !== current.host) ||
    (patch.port !== undefined && patch.port !== current.port) ||
    (patch.protocol !== undefined && patch.protocol !== current.protocol);
  if (current.protocol === 'sftp' && identityChanged) {
    next.sftpHostKeyFingerprint = null;
  }
  if (next.protocol !== 'sftp') {
    next.sftpHostKeyFingerprint = null;
  }
  return next;
}

function normalizeWebDavAddress(
  value: string,
  currentHttps: boolean,
): Pick<RemoteHost, 'host' | 'https'> {
  const trimmed = value.trim();
  const schemeMatch = /^(https?):\/\/(.+)$/i.exec(trimmed);
  return {
    host: schemeMatch?.[2]?.replace(/\/+$/, '') ?? trimmed.replace(/\/+$/, ''),
    https: schemeMatch ? schemeMatch[1].toLowerCase() === 'https' : currentHttps,
  };
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function defaultPortFor(protocol: Protocol): number {
  switch (protocol) {
    case 'sftp':
      return 22;
    case 'webdav':
      return 0;
    case 'ftp':
      return 21;
    case 's3':
      return 443;
    case 'scp':
      return 22;
    default:
      return 0;
  }
}
