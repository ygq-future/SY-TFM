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
    expect(source).toContain('await onSave(contentBeingSaved, expectedRevision)');
    const saveHandler = source.slice(
      source.indexOf('const save = useCallback'),
      source.indexOf('const requestClose'),
    );
    expect(saveHandler).not.toContain('onClose()');
    expect(source).toContain('readRemoteTextSnapshot(hostId, remotePath)');
    expect(source).toContain('getRemoteConflictSnapshot(saveError)');
    expect(source).toContain('reloadRemote');
    expect(source).toContain('keepLocal');
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

  it('styles the search panel as part of the current editor surface', () => {
    expect(styles).toContain('.online-editor-body .cm-search');
    expect(styles).toContain('.online-editor-body .cm-search label');
    expect(styles).toContain('.cm-search .cm-textfield');
    expect(styles).toContain('.cm-search .cm-button');
    expect(styles).toContain(".online-editor-body .cm-search input[type='checkbox']");
    expect(styles).toContain('transform: translateX(14px);');
    expect(styles).toContain('align-items: center;');
  });

  it('keeps desktop window chrome opt-in for the embedded Android editor', () => {
    expect(source).toContain('windowed = false');
    expect(source).toContain('if (!windowed) return;');
    expect(styles).toMatch(
      /\.online-editor-backdrop--windowed\s*\{[^}]*backdrop-filter: blur\(var\(--glass-blur/s,
    );
    expect(styles).toMatch(/\.online-editor-backdrop--windowed\s*\{[^}]*animation: none;/s);
    expect(styles).not.toMatch(/html\.mobile-platform[\s\S]*?\.online-editor-backdrop--windowed/s);
  });

  it('blurs the editor window background before the document surface mounts', () => {
    expect(styles).toMatch(
      /\.editor-window-shell::before\s*\{[^}]*filter: blur\(var\(--glass-blur/s,
    );
    expect(styles).toContain('transform: scale(1.08);');
    expect(styles).toMatch(
      /\.editor-window-loading,[\s\S]*?\.editor-window-error\s*\{[^}]*backdrop-filter: blur\(var\(--glass-blur/s,
    );
  });
});
