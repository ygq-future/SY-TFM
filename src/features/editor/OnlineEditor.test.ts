import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OnlineEditor', () => {
  const source = readFileSync(new URL('./OnlineEditor.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

  it('loads common CodeMirror language support and wraps long lines', () => {
    expect(source).toContain("from '@codemirror/language-data'");
    expect(source).toContain('LanguageDescription.matchFilename');
    expect(source).toContain('EditorView.lineWrapping');
    expect(source).toContain('autocompletion: false');
  });

  it('saves without closing and supports the desktop save shortcut', () => {
    expect(source).toContain("event.key.toLowerCase() === 's'");
    expect(source).toContain('await onSave(content)');
    const saveHandler = source.slice(
      source.indexOf('const save = useCallback'),
      source.indexOf('const requestClose'),
    );
    expect(saveHandler).not.toContain('onClose()');
  });

  it('keeps the CodeMirror viewport scrollable by wheel and touch', () => {
    expect(source).toContain('className="online-editor-codemirror"');
    expect(styles).toMatch(
      /\.online-editor-codemirror\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/s,
    );
    expect(styles).toMatch(
      /\.online-editor-body \.cm-scroller\s*\{[^}]*height:\s*100% !important;[^}]*overflow-y:\s*auto !important;[^}]*touch-action:\s*pan-x pan-y/s,
    );
    expect(styles).not.toContain('flex: 1 1 0;');
  });
});
