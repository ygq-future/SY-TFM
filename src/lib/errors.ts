import type { ErrorCode } from '../types/enums/ErrorCode';
import i18n from './i18n';

/** Tauri 后端统一错误的前端表示。 */
export interface AppErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** 首次遇到 SFTP 主机密钥时的安全详情。 */
export interface HostKeyUnknownDetails {
  host: string;
  port: number;
  actualFingerprint: string;
}

/** SFTP 主机密钥发生变化时的安全详情。 */
export interface HostKeyChangedDetails extends HostKeyUnknownDetails {
  expectedFingerprint: string;
}

/** 判断未知异常是否为指定的后端错误码。 */
export function hasAppErrorCode(error: unknown, code: ErrorCode): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return (error as { code?: unknown }).code === code;
}

function hostKeyDetails(error: unknown, code: ErrorCode): Record<string, unknown> | null {
  if (
    !hasAppErrorCode(error, code) ||
    !error ||
    typeof error !== 'object' ||
    !('details' in error)
  ) {
    return null;
  }
  const details = (error as { details?: unknown }).details;
  return details !== null && typeof details === 'object'
    ? (details as Record<string, unknown>)
    : null;
}

/** 安全解析首次出现的 SFTP 主机密钥详情。 */
export function getHostKeyUnknownDetails(error: unknown): HostKeyUnknownDetails | null {
  const details = hostKeyDetails(error, 'host_key_unknown');
  if (
    !details ||
    typeof details.host !== 'string' ||
    typeof details.port !== 'number' ||
    !Number.isInteger(details.port) ||
    typeof details.actualFingerprint !== 'string'
  ) {
    return null;
  }
  return {
    host: details.host,
    port: details.port,
    actualFingerprint: details.actualFingerprint,
  };
}

/** 安全解析已变化的 SFTP 主机密钥详情。 */
export function getHostKeyChangedDetails(error: unknown): HostKeyChangedDetails | null {
  const details = hostKeyDetails(error, 'host_key_changed');
  if (
    !details ||
    typeof details.host !== 'string' ||
    typeof details.port !== 'number' ||
    !Number.isInteger(details.port) ||
    typeof details.expectedFingerprint !== 'string' ||
    typeof details.actualFingerprint !== 'string'
  ) {
    return null;
  }
  return {
    host: details.host,
    port: details.port,
    expectedFingerprint: details.expectedFingerprint,
    actualFingerprint: details.actualFingerprint,
  };
}

/** 将任意异常转换为可展示文本，保留后端 AppError 的 message。 */
export function formatAppError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return i18n.t('common.unknownError');
  }
}
