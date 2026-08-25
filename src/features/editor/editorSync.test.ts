import { describe, expect, it } from 'vitest';

import { classifyRemoteChange } from './editorSync';

describe('online editor remote change policy', () => {
  it('reloads a changed remote document when the editor is clean', () => {
    expect(
      classifyRemoteChange('base', 'base', 'revision-1', {
        content: 'remote update',
        revision: 'revision-2',
      }),
    ).toBe('reload');
  });

  it('blocks a stale save when the editor has local changes', () => {
    expect(
      classifyRemoteChange('local draft', 'base', 'revision-1', {
        content: 'remote update',
        revision: 'revision-2',
      }),
    ).toBe('conflict');
  });

  it('ignores the editor own unchanged remote revision', () => {
    expect(
      classifyRemoteChange('same', 'same', 'revision-1', {
        content: 'same',
        revision: 'revision-1',
      }),
    ).toBe('unchanged');
  });
});
