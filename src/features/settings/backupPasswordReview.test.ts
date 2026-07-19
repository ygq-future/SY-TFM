import { describe, expect, it } from 'vitest';
import { reviewBackupPassword } from './backupPasswordReview';

describe('backup password review', () => {
  it('makes visually ambiguous whitespace explicit without changing the password', () => {
    expect(reviewBackupPassword(' pass\tword\u00a0')).toEqual({
      raw: ' pass\tword\u00a0',
      visualized: '·pass⇥word⍽',
      characterCount: 11,
      whitespaceCount: 3,
      hasBoundaryWhitespace: true,
    });
  });

  it('counts Unicode code points instead of UTF-16 units', () => {
    expect(reviewBackupPassword('密碼🔐value').characterCount).toBe(8);
  });
});
