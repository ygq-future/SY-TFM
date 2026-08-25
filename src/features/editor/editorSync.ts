import type { RemoteTextSnapshot } from '../../types/generated/RemoteTextSnapshot';
import { hasAppErrorCode } from '../../lib/errors';

/** 在线编辑器发现远程版本变化后的处理分支。 */
export type RemoteChangeDisposition = 'unchanged' | 'reload' | 'conflict';

/** 根据草稿状态决定是否安全地把远程快照同步回编辑器。 */
export function classifyRemoteChange(
  content: string,
  savedContent: string,
  currentRevision: string,
  snapshot: RemoteTextSnapshot,
): RemoteChangeDisposition {
  if (snapshot.revision === currentRevision) return 'unchanged';
  return content === savedContent ? 'reload' : 'conflict';
}

/** 从保存冲突的统一错误详情中提取最新远程快照。 */
export function getRemoteConflictSnapshot(error: unknown): RemoteTextSnapshot | null {
  if (!hasAppErrorCode(error, 'sync_conflict') || !error || typeof error !== 'object') return null;
  const details = 'details' in error ? error.details : null;
  if (!details || typeof details !== 'object') return null;
  const snapshot = details as { content?: unknown; revision?: unknown };
  if (typeof snapshot.content !== 'string' || typeof snapshot.revision !== 'string') return null;
  return { content: snapshot.content, revision: snapshot.revision };
}
