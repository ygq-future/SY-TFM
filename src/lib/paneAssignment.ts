/** 两个文件面板所显示的连接。 */
export type PaneHosts = [string | null, string | null];

/** 用户显式激活主机时，返回可见面板分配与焦点位置。 */
export function activateHostInPane(
  current: PaneHosts,
  hostId: string,
  isDualPane: boolean,
  activePane: 0 | 1,
): { hosts: PaneHosts; activePane: 0 | 1 } {
  if (!isDualPane) return { hosts: [hostId, hostId], activePane: 0 };
  if (current[0] === hostId) return { hosts: current, activePane: 0 };
  if (current[1] === hostId) return { hosts: current, activePane: 1 };

  const hosts = assignConnectedHost(current, hostId, true);
  const targetPane = hosts[0] === hostId ? 0 : hosts[1] === hostId ? 1 : activePane;
  return { hosts, activePane: targetPane };
}

/** 新连接始终先填充第一个空面板，再填充第二个面板。 */
export function assignConnectedHost(
  current: PaneHosts,
  hostId: string,
  isDualPane: boolean,
): PaneHosts {
  if (current[0] === hostId || current[1] === hostId) return current;
  if (!current[0]) return [hostId, current[1]];
  if (isDualPane && (!current[1] || current[1] === current[0])) return [current[0], hostId];
  return current;
}

/** 根据真实连接集合修复面板分配，并保证第一个可见面板不为空。 */
export function reconcilePaneHosts(
  current: PaneHosts,
  connectedHostIds: string[],
  isDualPane: boolean,
): PaneHosts {
  if (connectedHostIds.length === 0) return [null, null];

  let first = current[0] && connectedHostIds.includes(current[0]) ? current[0] : null;
  let second = current[1] && connectedHostIds.includes(current[1]) ? current[1] : null;

  if (!first && second) first = second;
  if (!first) first = connectedHostIds[0] ?? null;

  if (isDualPane && !second) {
    second = connectedHostIds.find((hostId) => hostId !== first) ?? null;
  }

  return [first, second];
}

/** 关闭双面板时将仍有内容的第二面板提升到第一面板。 */
export function collapseToSinglePane(current: PaneHosts): PaneHosts {
  return current[0] ? current : [current[1], current[1]];
}
