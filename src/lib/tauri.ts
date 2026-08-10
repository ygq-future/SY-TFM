import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { Protocol } from '../types/enums/Protocol';
import type { ConnectionStatus } from '../types/enums/ConnectionStatus';
import type { AdapterCapability } from '../types/enums/AdapterCapability';
import type { SortColumn } from '../types/enums/SortColumn';
import type { RemoteHost } from '../types/generated/RemoteHost';
import type { RemoteFile } from '../types/generated/RemoteFile';
import type { AppSettings } from '../types/generated/AppSettings';
import type { StoragePaths } from '../types/generated/StoragePaths';
import type { HostDto } from '../types/generated/HostDto';
import type { ConnectionStatusPayload } from '../types/generated/ConnectionStatusPayload';
import type { ProgressPayload } from '../types/generated/ProgressPayload';
import type { BatchProgressPayload } from '../types/generated/BatchProgressPayload';
import type { RemoteEditSessionInfo } from '../types/generated/RemoteEditSessionInfo';
import type { EditorSyncedPayload } from '../types/generated/EditorSyncedPayload';
import type { EditorErrorPayload } from '../types/generated/EditorErrorPayload';
import type { EditorSessionInvalidPayload } from '../types/generated/EditorSessionInvalidPayload';
import type { DownloadRequest } from '../types/generated/DownloadRequest';
import type { VaultSyncStatus } from '../types/generated/VaultSyncStatus';
import type { VaultWebDavCredentials } from '../types/generated/VaultWebDavCredentials';

// ============================================================
// 类型定义（对应后端 commands 层返回值）
// ============================================================

/** 应用元信息。 */
export interface AppInfo {
  name: string;
  version: string;
  developer: string;
  license: string;
  githubUrl: string;
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

/** 使用未保存的表单配置测试连接。 */
export async function testHostConnection(host: RemoteHost, password?: string): Promise<void> {
  await invoke('test_host_connection', { host, password });
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

/** 读取远程 UTF-8 文本，供内置在线编辑器使用。 */
export async function readRemoteText(hostId: string, remotePath: string): Promise<string> {
  return invoke<string>('read_remote_text', { hostId, remotePath });
}

/** 下载到受管临时目录并建立外部编辑器同步监听。 */
export async function startRemoteEdit(
  hostId: string,
  remotePath: string,
  fileName: string,
): Promise<RemoteEditSessionInfo> {
  return invoke<RemoteEditSessionInfo>('start_remote_edit', { hostId, remotePath, fileName });
}

/** 列出指定主机当前仍有效的外部编辑器监听。 */
export async function listRemoteEditSessions(hostId: string): Promise<RemoteEditSessionInfo[]> {
  return invoke<RemoteEditSessionInfo[]>('list_remote_edit_sessions', { hostId });
}

/** 停止外部编辑器同步监听并清理临时文件。 */
export async function stopRemoteEdit(editSessionId: string): Promise<boolean> {
  return invoke<boolean>('stop_remote_edit', { editSessionId });
}

// ============================================================
// 文件操作命令
// ============================================================

/** 下载文件。 */
export async function downloadFile(
  hostId: string,
  remotePath: string,
  localDirectory: string,
  localName: string,
  isDirectory = false,
  operationId: string,
): Promise<void> {
  const request: DownloadRequest = {
    hostId,
    remotePath,
    localDirectory,
    localName,
    isDirectory,
    operationId,
  };
  await invoke('download_file', { request });
}

/** 注册一个可取消的传输任务。 */
export async function beginTransfer(operationId: string, hostIds: string[]): Promise<void> {
  await invoke('begin_transfer', { operationId, hostIds });
}

/** 请求取消指定传输任务。 */
export async function cancelTransfer(operationId: string): Promise<boolean> {
  return invoke<boolean>('cancel_transfer', { operationId });
}

/** 释放传输任务注册信息。 */
export async function finishTransfer(operationId: string): Promise<void> {
  await invoke('finish_transfer', { operationId });
}

/** 在两个已连接面板之间递归传输文件或目录。 */
export async function transferEntry(
  sourceHostId: string,
  targetHostId: string,
  sourcePath: string,
  targetPath: string,
  isDirectory: boolean,
  operationId: string,
): Promise<void> {
  await invoke('transfer_entry', {
    request: {
      sourceHostId,
      targetHostId,
      sourcePath,
      targetPath,
      isDirectory,
      operationId,
    },
  });
}

/** 上传文件。 */
export async function uploadFile(
  hostId: string,
  localPath: string,
  remotePath: string,
  operationId: string,
): Promise<void> {
  await invoke('upload_file', { hostId, localPath, remotePath, operationId });
}

/** 上传内存内容（拖拽/新建文件用）。 */
export async function uploadContent(
  hostId: string,
  remotePath: string,
  content: Uint8Array | string,
  operationId: string,
): Promise<void> {
  const payload =
    typeof content === 'string'
      ? Array.from(new TextEncoder().encode(content))
      : Array.from(content);
  await invoke('upload_content', { hostId, remotePath, content: payload, operationId });
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

/** 加密导出完整配置。 */
export async function exportSettingsEncrypted(filePath: string): Promise<void> {
  await invoke('export_settings_encrypted', { filePath });
}

/** 导入并解密完整配置。 */
export async function importSettingsEncrypted(filePath: string): Promise<AppSettings> {
  return invoke<AppSettings>('import_settings_encrypted', { filePath });
}

/** 获取跨设备保险库同步状态。 */
export async function getVaultSyncStatus(): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('get_vault_sync_status');
}

/** 验证并保存保险库 WebDAV 配置，不写入远端数据。 */
export async function testVaultWebDav(
  credentials: VaultWebDavCredentials,
  backupPassword?: string,
): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('test_and_save_vault_webdav', {
    credentials,
    backupPassword: backupPassword || null,
  });
}

/** 校验并保存便携备份与 WebDAV 恢复共用的备份密码。 */
export async function saveVaultBackupPassword(
  password: string,
  confirmation: string,
): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('save_vault_backup_password', { password, confirmation });
}

/** 创建跨设备保险库并上传至 WebDAV 的 SY-TFM 目录。 */
export async function enableVaultSync(
  credentials: VaultWebDavCredentials,
  backupPassword?: string,
  overwriteExisting = false,
): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('enable_vault_sync', {
    credentials,
    backupPassword: backupPassword || null,
    overwriteExisting,
  });
}

/** 立即双向核对云端保险库，只在本地范围确有变化时上传新的 revision。 */
export async function syncVaultNow(backupPassword?: string): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('sync_vault_now', {
    backupPassword: backupPassword || null,
  });
}

/** 从 WebDAV 的 SY-TFM 目录恢复保险库。 */
export async function restoreVaultFromWebDav(
  credentials: VaultWebDavCredentials,
  backupPassword?: string,
): Promise<AppSettings> {
  return invoke<AppSettings>('restore_vault_from_webdav', {
    credentials,
    backupPassword: backupPassword || null,
  });
}

/** 暂停同步，保留本机凭据、备份密码和云端密文。 */
export async function pauseVaultSync(): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('pause_vault_sync');
}

/** 恢复已初始化保险库的同步并立即同步当前配置。 */
export async function resumeVaultSync(): Promise<VaultSyncStatus> {
  return invoke<VaultSyncStatus>('resume_vault_sync');
}

/** 导出用户备份密码保护的便携保险库。 */
export async function exportPortableVault(
  filePath: string,
  backupPassword?: string,
): Promise<void> {
  await invoke('export_portable_vault', {
    filePath,
    backupPassword: backupPassword || null,
  });
}

/** 导入便携保险库并转换为当前设备的本地加密。 */
export async function importPortableVault(
  filePath: string,
  backupPassword?: string,
): Promise<AppSettings> {
  return invoke<AppSettings>('import_portable_vault', {
    filePath,
    backupPassword: backupPassword || null,
  });
}

/** 获取当前平台解析后的默认下载和应用数据目录。 */
export async function getStoragePaths(): Promise<StoragePaths> {
  return invoke<StoragePaths>('get_storage_paths');
}

/** 查询当前是否运行于 Tauri 移动平台。 */
export async function isMobilePlatform(): Promise<boolean> {
  return invoke<boolean>('is_mobile_platform');
}

/** 将本地背景图片安全读取为 WebView 可用的 Data URL。 */
export async function loadBackgroundImage(filePath: string): Promise<string> {
  return invoke<string>('load_background_image', { filePath });
}

/** 以原始二进制读取背景图片，供 Android 创建短生命周期 Blob URL。 */
export async function loadBackgroundImageBytes(filePath: string): Promise<ArrayBuffer> {
  return invoke<ArrayBuffer>('load_background_image_bytes', { filePath });
}

/** 根据已验证的背景路径返回 Blob MIME；未知扩展名交给 WebView 内容嗅探。 */
export function backgroundImageMimeType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'bmp') return 'image/bmp';
  if (extension === 'avif') return 'image/avif';
  return '';
}

/** 将 Android Photo Picker 的临时 content URI 导入应用私有存储。 */
export async function importBackgroundImage(filePath: string): Promise<string> {
  return invoke<string>('import_background_image', { filePath });
}

/** 获取持久化的界面基础字号。 */
export async function getFontSize(): Promise<number> {
  return invoke<number>('get_font_size');
}

/** 保存界面基础字号。 */
export async function setFontSize(fontSize: number): Promise<void> {
  await invoke('set_font_size', { fontSize });
}

/** 获取主机列表。 */
export async function getHosts(): Promise<RemoteHost[]> {
  return invoke<RemoteHost[]>('get_hosts');
}

/** 保存主机（新增/更新）。 */
export async function saveHost(host: RemoteHost, clearPassword = false): Promise<void> {
  await invoke('save_host', { host, clearPassword });
}

/** 按 ID 顺序持久化主机列表。 */
export async function reorderHosts(hostIds: string[]): Promise<void> {
  await invoke('reorder_hosts', { hostIds });
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

/** 监听保险库后台同步阶段变化。 */
export async function onVaultSyncStatus(
  callback: (payload: VaultSyncStatus) => void,
): Promise<UnlistenFn> {
  return listen<VaultSyncStatus>('vault:status', (event) => callback(event.payload));
}

/** 监听下载进度。 */
export async function onDownloadProgress(
  callback: (payload: ProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProgressPayload>('download:progress', (event) => callback(event.payload));
}

/** 监听下载完成。 */
export async function onDownloadDone(
  callback: (payload: ProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProgressPayload>('download:done', (event) => callback(event.payload));
}

/** 监听目录下载中的文件计数进度。 */
export async function onDownloadBatchProgress(
  callback: (payload: BatchProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<BatchProgressPayload>('download:batch-progress', (event) =>
    callback(event.payload),
  );
}

/** 监听上传进度。 */
export async function onUploadProgress(
  callback: (payload: ProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProgressPayload>('upload:progress', (event) => callback(event.payload));
}

/** 监听上传完成。 */
export async function onUploadDone(
  callback: (payload: ProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProgressPayload>('upload:done', (event) => callback(event.payload));
}

/** 监听外部编辑器文件同步成功。 */
export async function onEditorSynced(
  callback: (payload: EditorSyncedPayload) => void,
): Promise<UnlistenFn> {
  return listen<EditorSyncedPayload>('editor:synced', (event) => callback(event.payload));
}

/** 监听外部编辑器文件同步失败。 */
export async function onEditorError(
  callback: (payload: EditorErrorPayload) => void,
): Promise<UnlistenFn> {
  return listen<EditorErrorPayload>('editor:error', (event) => callback(event.payload));
}

/** 监听外部编辑会话失效。 */
export async function onEditorSessionInvalid(
  callback: (payload: EditorSessionInvalidPayload) => void,
): Promise<UnlistenFn> {
  return listen<EditorSessionInvalidPayload>('editor:session-invalid', (event) =>
    callback(event.payload),
  );
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
