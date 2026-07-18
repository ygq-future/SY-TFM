import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, InputDialog } from './Dialog';
import '../../lib/i18n';

describe('Dialog components', () => {
  it('renders confirm content and danger styling', () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        title="确认删除"
        message="操作不可撤销"
        confirmLabel="删除"
        danger
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(markup).toContain('确认删除');
    expect(markup).toContain('操作不可撤销');
    expect(markup).toContain('danger-button');
  });

  it('renders the input default value', () => {
    const markup = renderToStaticMarkup(
      <InputDialog
        title="重命名"
        label="文件名"
        defaultValue="notes.txt"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(markup).toContain('notes.txt');
    expect(markup).toContain('文件名');
  });
});
