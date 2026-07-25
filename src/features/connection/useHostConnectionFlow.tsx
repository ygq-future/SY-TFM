import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/shared/Dialog';
import { useConnectionStore } from '../../stores/connectionStore';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import { getHostKeyUnknownDetails, hasAppErrorCode } from '../../lib/errors';
import { PasswordPromptDialog } from './PasswordPromptDialog';

interface PendingHostKey {
  host: RemoteHost;
  password?: string;
  rememberPassword: boolean;
  fingerprint: string;
  endpoint: string;
}

/** 统一侧栏与桌面路径栏的连接、密码询问及 SFTP 主机密钥确认流程。 */
export function useHostConnectionFlow(onConnected: (hostId: string) => void): {
  requestConnection: (host: RemoteHost) => void;
  connectionDialogs: ReactNode;
} {
  const { t } = useTranslation();
  const { connectHost, updateHost } = useConnectionStore();
  const [passwordPromptHost, setPasswordPromptHost] = useState<RemoteHost | null>(null);
  const [pendingHostKey, setPendingHostKey] = useState<PendingHostKey | null>(null);

  const captureUnknownHostKey = (
    host: RemoteHost,
    password: string | undefined,
    rememberPassword: boolean,
    error: unknown,
  ) => {
    const details = getHostKeyUnknownDetails(error);
    if (!details) return false;
    useConnectionStore.setState({ error: null });
    setPendingHostKey({
      host,
      password,
      rememberPassword,
      fingerprint: details.actualFingerprint,
      endpoint: `${details.host}:${details.port}`,
    });
    return true;
  };

  const connectAndOpen = async (host: RemoteHost, password?: string, rememberPassword = false) => {
    try {
      await connectHost(host.id, password);
      onConnected(host.id);
    } catch (error) {
      if (captureUnknownHostKey(host, password, rememberPassword, error)) return;
      throw error;
    }
  };

  const requestConnection = (host: RemoteHost) => {
    if (!host.password) {
      setPasswordPromptHost(host);
      return;
    }
    void connectAndOpen(host).catch((error: unknown) => {
      if (hasAppErrorCode(error, 'crypto_decrypt_failed')) {
        useConnectionStore.setState({ error: null });
        setPasswordPromptHost(host);
      }
    });
  };

  const connectionDialogs = (
    <>
      {passwordPromptHost && (
        <PasswordPromptDialog
          hostName={passwordPromptHost.name}
          onConfirm={(password, remember) => {
            const host = passwordPromptHost;
            setPasswordPromptHost(null);
            void connectAndOpen(host, password, remember).catch(() => undefined);
          }}
          onCancel={() => setPasswordPromptHost(null)}
        />
      )}
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
            useConnectionStore.setState({ error: null });
            void (async () => {
              const trustedHost = {
                ...pending.host,
                password: pending.rememberPassword ? (pending.password ?? '') : '',
                sftpHostKeyFingerprint: pending.fingerprint,
              };
              await updateHost(trustedHost);
              await connectAndOpen(trustedHost, pending.password);
            })().catch(() => undefined);
          }}
          onCancel={() => setPendingHostKey(null)}
        />
      )}
    </>
  );

  return { requestConnection, connectionDialogs };
}
