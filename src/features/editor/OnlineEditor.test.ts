import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OnlineEditor', () => {
  const source = readFileSync(new URL('./OnlineEditor.tsx', import.meta.url), 'utf8');

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
});
