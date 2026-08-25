/** 移动端第一次返回时显示确认提示，短时间内再次返回才允许窗口关闭。 */
export const MOBILE_EXIT_CONFIRMATION_WINDOW_MS = 2000;

/** 判断当前关闭请求是否仍需要被拦截。 */
export function shouldPreventMobileExit(
  lastRequestAt: number | null,
  currentTime: number,
): boolean {
  if (lastRequestAt === null) return true;
  const elapsed = currentTime - lastRequestAt;
  return elapsed < 0 || elapsed > MOBILE_EXIT_CONFIRMATION_WINDOW_MS;
}
