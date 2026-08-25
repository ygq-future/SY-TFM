import { describe, expect, it } from 'vitest';
import { MOBILE_EXIT_CONFIRMATION_WINDOW_MS, shouldPreventMobileExit } from './mobileExitGuard';

describe('mobile exit guard', () => {
  it('blocks the first back request', () => {
    expect(shouldPreventMobileExit(null, 1000)).toBe(true);
  });

  it('allows a second request during the confirmation window', () => {
    expect(shouldPreventMobileExit(1000, 1000 + MOBILE_EXIT_CONFIRMATION_WINDOW_MS)).toBe(false);
  });

  it('starts a new confirmation after the window expires or the clock moves backwards', () => {
    expect(shouldPreventMobileExit(1000, 1000 + MOBILE_EXIT_CONFIRMATION_WINDOW_MS + 1)).toBe(true);
    expect(shouldPreventMobileExit(1000, 999)).toBe(true);
  });
});
