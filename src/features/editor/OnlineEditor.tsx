import { useCallback, useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { LanguageDescription, type LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { Check, FileCode2, LoaderCircle, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ModalPortal } from '../../components/shared/ModalPortal';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatAppError } from '../../lib/errors';

type LoadedLanguage = LanguageSupport;

interface OnlineEditorProps {
  fileName: string;
  remotePath: string;
  initialContent: string;
  onSave: (content: string) => Promise<string>;
  onClose: () => void;
}

/** 内置轻量文本编辑器：文件名只用于语法高亮，是否为文本由后端按内容判定。 */
export function OnlineEditor({
  fileName,
  remotePath,
  initialContent,
  onSave,
  onClose,
}: OnlineEditorProps) {
  const { t } = useTranslation();
  const theme = useSettingsStore((state) => state.theme);
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [language, setLanguage] = useState<LoadedLanguage | null>(null);
  const [languageName, setLanguageName] = useState(t('editor.plainText'));
  const [isSaving, setIsSaving] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDirty = content !== savedContent;

  useEffect(() => {
    let active = true;
    const description = LanguageDescription.matchFilename(languages, fileName);
    if (!description) {
      setLanguage(null);
      setLanguageName(t('editor.plainText'));
      return () => {
        active = false;
      };
    }
    setLanguageName(description.name);
    void description.load().then((support) => {
      if (active) setLanguage(support);
    });
    return () => {
      active = false;
    };
  }, [fileName, t]);

  const save = useCallback(async () => {
    if (isSaving || !isDirty) return;
    setIsSaving(true);
    setError(null);
    try {
      const syncTime = await onSave(content);
      setSavedContent(content);
      setLastSynced(syncTime);
    } catch (saveError) {
      setError(formatAppError(saveError));
    } finally {
      setIsSaving(false);
    }
  }, [content, isDirty, isSaving, onSave]);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [requestClose, save]);

  const extensions = useMemo(
    () => (language ? [language, EditorView.lineWrapping] : [EditorView.lineWrapping]),
    [language],
  );

  return (
    <ModalPortal>
      <div className="online-editor-backdrop" role="presentation">
        <section
          className="online-editor"
          role="dialog"
          aria-modal="true"
          aria-labelledby="online-editor-title"
        >
          <header className="online-editor-header">
            <div className="online-editor-identity">
              <span className="online-editor-file-icon" aria-hidden="true">
                <FileCode2 />
              </span>
              <div>
                <strong id="online-editor-title">{fileName}</strong>
                <span title={remotePath}>{remotePath}</span>
              </div>
            </div>
            <div className="online-editor-actions">
              <span className="online-editor-language">{languageName}</span>
              <button
                className="online-editor-save"
                type="button"
                disabled={isSaving || !isDirty}
                onClick={() => void save()}
              >
                {isSaving ? <LoaderCircle className="is-spinning" /> : <Save />}
                {isSaving ? t('editor.saving') : t('editor.save')}
              </button>
              <button
                className="icon-button online-editor-close"
                type="button"
                title={t('common.close')}
                onClick={requestClose}
              >
                <X />
              </button>
            </div>
          </header>

          <div className="online-editor-body">
            <CodeMirror
              className="online-editor-codemirror"
              value={content}
              height="100%"
              theme={theme}
              extensions={extensions}
              onChange={setContent}
              basicSetup={{
                autocompletion: false,
                closeBrackets: false,
                foldGutter: false,
                highlightActiveLineGutter: true,
              }}
            />
          </div>

          <footer className="online-editor-footer">
            <span
              className={isDirty ? 'editor-dirty-indicator is-dirty' : 'editor-dirty-indicator'}
            >
              <i />
              {isDirty ? t('editor.unsaved') : t('editor.saved')}
            </span>
            {error ? (
              <span className="online-editor-error">{error}</span>
            ) : lastSynced ? (
              <span className="online-editor-synced">
                <Check /> {t('editor.syncedAt', { time: lastSynced })}
              </span>
            ) : (
              <span>{t('editor.saveShortcut')}</span>
            )}
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}
