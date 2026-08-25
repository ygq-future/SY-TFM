import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LoaderCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  beginTransfer,
  finishTransfer,
  loadBackgroundImage,
  readRemoteTextSnapshot,
  uploadRemoteTextIfUnchanged,
} from '../../lib/tauri';
import { formatAppError } from '../../lib/errors';
import i18n from '../../lib/i18n';
import { createTransferOperationId } from '../../stores/browserStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { RemoteTextSnapshot } from '../../types/generated/RemoteTextSnapshot';

const OnlineEditor = lazy(async () => {
  const module = await import('./OnlineEditor');
  return { default: module.OnlineEditor };
});

interface EditorTarget {
  hostId: string;
  remotePath: string;
  fileName: string;
}

function readEditorTarget(): EditorTarget | null {
  const query = new URLSearchParams(window.location.search);
  const hostId = query.get('hostId');
  const remotePath = query.get('remotePath');
  const fileName = query.get('fileName');
  if (!hostId || !remotePath || !fileName) return null;
  return { hostId, remotePath, fileName };
}

/** 独立编辑器窗口的加载壳；每个窗口拥有自己的文档、冲突和保存生命周期。 */
export function EditorWindow() {
  const { t } = useTranslation();
  const {
    theme,
    accentColor,
    backgroundImage,
    backgroundImageEnabled,
    backgroundOpacity,
    glassBlur,
    glassOpacity,
    fontSize,
    headingFontSize,
    labelFontSize,
    captionFontSize,
    dataFontSize,
    language,
  } = useSettingsStore();
  const [target] = useState(readEditorTarget);
  const [snapshot, setSnapshot] = useState<RemoteTextSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backgroundImageSource, setBackgroundImageSource] = useState<string | null>(null);
  const currentWindow = getCurrentWebviewWindow();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accentColor;
    document.documentElement.style.setProperty('--ui-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--type-body-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--type-heading-size', `${headingFontSize}px`);
    document.documentElement.style.setProperty('--type-label-size', `${labelFontSize}px`);
    document.documentElement.style.setProperty('--type-caption-size', `${captionFontSize}px`);
    document.documentElement.style.setProperty('--type-data-size', `${dataFontSize}px`);
    document.documentElement.style.setProperty('--glass-blur', `${glassBlur}px`);
    document.documentElement.style.setProperty('--glass-opacity', String(glassOpacity));
    document.documentElement.style.setProperty(
      '--glass-opacity-percent',
      `${Math.round(glassOpacity * 100)}%`,
    );
    void i18n.changeLanguage(language);
  }, [
    accentColor,
    captionFontSize,
    dataFontSize,
    fontSize,
    glassBlur,
    glassOpacity,
    headingFontSize,
    labelFontSize,
    language,
    theme,
  ]);

  useEffect(() => {
    let active = true;
    if (!backgroundImageEnabled || !backgroundImage) {
      setBackgroundImageSource(null);
      return () => {
        active = false;
      };
    }
    if (/^(data:|blob:|https?:)/i.test(backgroundImage)) {
      setBackgroundImageSource(backgroundImage);
      return () => {
        active = false;
      };
    }
    void loadBackgroundImage(backgroundImage)
      .then((source) => {
        if (active) setBackgroundImageSource(source);
      })
      .catch(() => {
        if (active) setBackgroundImageSource(null);
      });
    return () => {
      active = false;
    };
  }, [backgroundImage, backgroundImageEnabled]);

  useEffect(() => {
    if (!target) {
      setError(t('editor.windowTargetMissing'));
      return;
    }
    let active = true;
    void readRemoteTextSnapshot(target.hostId, target.remotePath)
      .then((nextSnapshot) => {
        if (active) setSnapshot(nextSnapshot);
      })
      .catch((loadError: unknown) => {
        if (active) setError(formatAppError(loadError));
      });
    return () => {
      active = false;
    };
  }, [t, target]);

  const close = useCallback(() => {
    void currentWindow.close();
  }, [currentWindow]);

  const appStyle = {
    ...(backgroundImageEnabled && backgroundImageSource
      ? {
          '--app-background-image': `url(${JSON.stringify(backgroundImageSource)})`,
        }
      : {}),
    '--ui-font-size': `${fontSize}px`,
    '--type-body-size': `${fontSize}px`,
    '--type-heading-size': `${headingFontSize}px`,
    '--type-label-size': `${labelFontSize}px`,
    '--type-caption-size': `${captionFontSize}px`,
    '--type-data-size': `${dataFontSize}px`,
    '--app-background-opacity': backgroundOpacity,
    '--glass-blur': `${glassBlur}px`,
    '--glass-opacity': glassOpacity,
    '--glass-opacity-percent': `${Math.round(glassOpacity * 100)}%`,
  } as CSSProperties;

  const renderWindowShell = (content: ReactNode) => (
    <main
      className="app-shell editor-window-shell"
      data-theme={theme}
      data-accent={accentColor}
      data-has-background={Boolean(backgroundImageEnabled && backgroundImageSource)}
      style={appStyle}
    >
      {content}
    </main>
  );

  const save = useCallback(
    async (content: string, expectedRevision: string) => {
      if (!target) throw new Error(t('editor.windowTargetMissing'));
      const operationId = createTransferOperationId('localToRemote');
      await beginTransfer(operationId, [target.hostId]);
      try {
        return await uploadRemoteTextIfUnchanged(
          target.hostId,
          target.remotePath,
          content,
          expectedRevision,
          operationId,
        );
      } finally {
        await finishTransfer(operationId);
      }
    },
    [t, target],
  );

  if (!target || error) {
    return renderWindowShell(
      <section className="editor-window-error">
        <div className="editor-window-error-icon" aria-hidden="true">
          <X />
        </div>
        <h1>{t('editor.windowOpenFailed')}</h1>
        <p>{error ?? t('editor.windowTargetMissing')}</p>
        <button type="button" onClick={close}>
          <X /> {t('common.close')}
        </button>
      </section>,
    );
  }

  if (!snapshot) {
    return renderWindowShell(
      <section className="editor-window-loading">
        <LoaderCircle className="is-spinning" aria-hidden="true" />
        <strong>{t('editor.opening', { name: target.fileName })}</strong>
        <button className="icon-button" type="button" title={t('common.close')} onClick={close}>
          <X />
        </button>
      </section>,
    );
  }

  return renderWindowShell(
    <Suspense fallback={null}>
      <OnlineEditor
        hostId={target.hostId}
        fileName={target.fileName}
        remotePath={target.remotePath}
        initialContent={snapshot.content}
        initialRevision={snapshot.revision}
        windowed
        onSave={save}
        onClose={close}
      />
    </Suspense>,
  );
}
