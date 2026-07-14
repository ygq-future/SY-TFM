import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('合并多个 class 字符串', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('tailwind-merge 解决冲突 class', () => {
    expect(cn('p-1', 'p-2')).toBe('p-2');
  });

  it('空输入返回空字符串', () => {
    expect(cn()).toBe('');
  });
});
