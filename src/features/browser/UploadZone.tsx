import { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useBrowserStore } from '../../stores/browserStore';
import * as tauri from '../../lib/tauri';
import { cn } from '../../lib/utils';

/** 拖拽上传区域（覆盖在文件列表上）。 */
export function UploadZone({ hostId }: { hostId: string }) {
  const [isDragging, setIsDragging] = useState(false);
  const { currentPath, refresh } = useBrowserStore();

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      for (const file of files) {
        const remotePath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
        // 读取本地文件内容并上传（Phase 1 简化：通过 upload_content 传内存内容）
        // TODO: Phase 2 实现大文件分块流式上传（upload_file + 本地路径）
        try {
          const buffer = await file.arrayBuffer();
          const content = new Uint8Array(buffer);
          await tauri.uploadContent(hostId, remotePath, content);
        } catch {
          // 上传失败时忽略单文件错误，继续处理其余文件
        }
      }
      await refresh(hostId);
    },
    [currentPath, hostId, refresh],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity',
        isDragging ? 'pointer-events-auto opacity-100' : 'opacity-0',
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/90 p-8 text-center dark:bg-blue-950/90">
        <UploadCloud className="mx-auto mb-2 h-10 w-10 text-blue-500" />
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">松开鼠标以上传文件</p>
      </div>
    </div>
  );
}
