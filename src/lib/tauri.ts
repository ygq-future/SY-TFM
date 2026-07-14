import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { Protocol } from '../types/enums/Protocol';
import type { ConnectionStatus } from '../types/enums/ConnectionStatus';
import type { AdapterCapability } from '../types/enums/AdapterCapability';
import type { SortColumn } from '../types/enums/SortColumn';
import type { RemoteHost } from '../types/generated/RemoteHost';
import type { RemoteFile } from '../types/generated/RemoteFile';
import type { AppSettings } from '../types/generated/AppSettings';
import type { HostDto } from '../types/generated/HostDto';
import type { ConnectionStatusPayload } from '../types/generated/ConnectionStatusPayload';

// ============================================================
// 类型定义（对应后端 commands 层返回值）
// ============================================================

/** 应用元信息。 */
export interface AppInfo {
  name: string;
  version: string;
}

/** connect_host 返回值。 */
export interface ConnectResult {
  hostId: string;
  homeDir: string;
  protocol: Protocol;
  capabilities: AdapterCapability;
}

/** get_connection_status 返回值。 */
export interface ConnectionStatusInfo {
  hostId: string;
  status: ConnectionStatus;
  isConnected: boolean;
  currentPath: string | null;
  sessionAge: number | null;
  protocol: Protocol | null;
}

/** get_connected_hosts 返回值条目。 */
export interface ConnectedHostInfo {
  hostId: string;
  hostName: string;
  currentPath: string;
  protocol: Protocol;
  capabilities: AdapterCapability;
}

/** get_adapter_capabilities 返回值。 */
export interface AdapterCapabilitiesInfo {
  protocol: Protocol;
  capabilities: AdapterCapability;
  supportedColumns: SortColumn[];
  supportsOwner: boolean;
  supportsPermissions: boolean;
  supportsSymlinks: boolean;
}

/** navigate_to_path 返回值。 */
export interface NavigateResult {
  currentPath: string;
  files: RemoteFile[];
}

// ============================================================
// 连接管理命令
// ============================================================

/** 连接远程主机。 */
export async function connectHost(hostId: string, password?: string): Promise<ConnectResult> {
  return invoke<ConnectResult>('connect_host', { hostId, password });
}

/** 断开主机连接。 */
export async function disconnectHost(hostId: string): Promise<void> {
  await invoke('disconnect_host', { hostId });
}

/** 查询主机连接状态。 */
export async function getConnectionStatus(hostId: string): Promise<ConnectionStatusInfo> {
  return invoke<ConnectionStatusInfo>('get_connection_status', { hostId });
}

/** 获取所有已连接的主机列表。 */
export async function getConnectedHosts(): Promise<ConnectedHostInfo[]> {
  return invoke<ConnectedHostInfo[]>('get_connected_hosts');
}

/** 查询 adapter 能力。 */
export async function getAdapterCapabilities(hostId: string): Promise<AdapterCapabilitiesInfo> {
  return invoke<AdapterCapabilitiesInfo>('get_adapter_capabilities', { hostId });
}

/** 确保主机有活跃会话（跨主机传输面板用）。 */
export async function ensureSession(
  hostId: string,
  password?: string,
): Promise<{ hostId: string; homeDir: string; protocol: Protocol }> {
  return invoke('ensure_session', { hostId, password });
}

/** 释放会话。 */
export async function releaseSession(hostId: string): Promise<void> {
  await invoke('release_session', { hostId });
}

// ============================================================
// 文件浏览命令
// ============================================================

/** 列出远程目录内容。 */
export async function listDirectory(hostId: string, path: string): Promise<RemoteFile[]> {
  return invoke<RemoteFile[]>('list_directory', { hostId, path });
}

/** 切换工作目录。 */
export async function changeDirectory(
  hostId: string,
  path: string,
): Promise<{ currentPath: string }> {
  return invoke('change_directory', { hostId, path });
}

/** 获取当前工作目录。 */
export async function getWorkingDirectory(hostId: string): Promise<string> {
  return invoke<string>('get_working_directory', { hostId });
}

/** 切换目录并列表（原子操作）。 */
export async function navigateToPath(hostId: string, path: string): Promise<NavigateResult> {
  return invoke<NavigateResult>('navigate_to_path', { hostId, path });
}

/** 检查文件/目录是否存在。 */
export async function fileExists(hostId: string, path: string): Promise<boolean> {
  return invoke<boolean>('file_exists', { hostId, path });
}

// ============================================================
// 文件操作命令
// ============================================================

/** 下载文件。 */
export async function downloadFile(
  hostId: string,
  remotePath: string,
  localPath: string,
): Promise<void> {
  await invoke('download_file', { hostId, remotePath, localPath });
}

/** 上传文件。 */
export async function uploadFile(
  hostId: string,
  localPath: string,
  remotePath: string,
): Promise<void> {
  await invoke('upload_file', { hostId, localPath, remotePath });
}

/** 上传内存内容（拖拽/新建文件用）。 */
export async function uploadContent(
  hostId: string,
  remotePath: string,
  content: Uint8Array | string,
): Promise<void> {
  const payload =
    typeof content === 'string'
      ? Array.from(new TextEncoder().encode(content))
      : Array.from(content);
  await invoke('upload_content', { hostId, remotePath, content: payload });
}

/** 删除文件/目录。 */
export async function deleteFile(hostId: string, path: string): Promise<void> {
  await invoke('delete_file', { hostId, path });
}

/** 创建目录。 */
export async function createDirectory(hostId: string, path: string): Promise<void> {
  await invoke('create_directory', { hostId, path });
}

/** 移动/重命名文件。 */
export async function moveFile(hostId: string, from: string, to: string): Promise<void> {
  await invoke('move_file', { hostId, from, to });
}

// ============================================================
// 设置命令
// ============================================================

/** 加载应用配置。 */
export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('load_settings');
}

/** 保存应用配置。 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke('save_settings', { settings });
}

/** 获取主机列表。 */
export async function getHosts(): Promise<RemoteHost[]> {
  return invoke<RemoteHost[]>('get_hosts');
}

/** 保存主机（新增/更新）。 */
export async function saveHost(host: RemoteHost): Promise<void> {
  await invoke('save_host', { host });
}

/** 删除主机。 */
export async function deleteHost(hostId: string): Promise<void> {
  await invoke('delete_host', { hostId });
}

/** 导出主机配置（不含密码）。 */
export async function exportHosts(): Promise<HostDto[]> {
  return invoke<HostDto[]>('export_hosts');
}

/** 导入主机配置。 */
export async function importHosts(hosts: HostDto[]): Promise<void> {
  await invoke('import_hosts', { hosts });
}

// ============================================================
// 事件监听
// ============================================================

/** 监听连接状态变化事件。 */
export async function onConnectionStatus(
  callback: (payload: ConnectionStatusPayload) => void,
): Promise<UnlistenFn> {
  return listen<ConnectionStatusPayload>('connection:status', (event) => {
    callback(event.payload);
  });
}

// ============================================================
// 应用信息命令
// ============================================================

/** 获取应用名称与版本。 */
export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('get_app_info');
}

/** 获取当前版本已支持的协议列表。 */
export async function getSupportedProtocols(): Promise<Protocol[]> {
  return invoke<Protocol[]>('get_supported_protocols');
}
