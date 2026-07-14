import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp } from 'lucide-react';
import type { RemoteFile } from '../../types/generated/RemoteFile';
import type { AdapterCapability } from '../../types/enums/AdapterCapability';
import { getFileIcon } from '../../lib/fileIcons';
import { cn } from '../../lib/utils';
import type { SortColumn } from '../../types/enums/SortColumn';

/** 能力位标志常量（对应 Rust AdapterCapability bitflags）。 */
const CAP_OWNER_PERMISSIONS = 1 << 0;

/** 格式化文件大小。 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** 文件列表（虚拟滚动 + 能力驱动列显示）。 */
export function FileList({
  files,
  capabilities,
  onOpen,
  onSelect,
  selectedFiles,
  onSort,
  sortColumn,
  sortOrder,
}: {
  files: RemoteFile[];
  capabilities: AdapterCapability | null;
  onOpen: (file: RemoteFile) => void;
  onSelect: (files: RemoteFile[]) => void;
  selectedFiles: RemoteFile[];
  onSort: (column: SortColumn) => void;
  sortColumn: SortColumn;
  sortOrder: 'ascending' | 'descending';
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const showOwner = capabilities !== null && (capabilities & CAP_OWNER_PERMISSIONS) !== 0;

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const handleRowClick = useCallback(
    (e: React.MouseEvent, file: RemoteFile) => {
      if (e.ctrlKey || e.metaKey) {
        // 多选切换
        const isSelected = selectedFiles.some((f) => f.fullPath === file.fullPath);
        if (isSelected) {
          onSelect(selectedFiles.filter((f) => f.fullPath !== file.fullPath));
        } else {
          onSelect([...selectedFiles, file]);
        }
      } else {
        onSelect([file]);
      }
    },
    [selectedFiles, onSelect],
  );

  const handleDoubleClick = useCallback(
    (file: RemoteFile) => {
      onOpen(file);
    },
    [onOpen],
  );

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <button className="flex items-center gap-1 hover:text-blue-600" onClick={() => onSort(column)}>
      {label}
      {sortColumn === column && (
        <span className="text-xs">{sortOrder === 'ascending' ? '▲' : '▼'}</span>
      )}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      {/* 表头 */}
      <div className="flex items-center border-b px-2 py-1.5 text-xs font-medium text-gray-500">
        <div className="w-8" />
        <div className="flex-1 px-2">
          <SortHeader column="name" label="名称" />
        </div>
        <div className="w-24 px-2 text-right">
          <SortHeader column="size" label="大小" />
        </div>
        <div className="w-40 px-2">
          <SortHeader column="lastModified" label="修改时间" />
        </div>
        {showOwner && (
          <>
            <div className="w-32 px-2">
              <SortHeader column="owner" label="所有者" />
            </div>
            <div className="w-28 px-2">
              <SortHeader column="permissions" label="权限" />
            </div>
          </>
        )}
      </div>
      {/* 虚拟列表 */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const file = files[virtualRow.index];
            if (!file) return null;
            const icon = getFileIcon(file.name, file.isDirectory);
            const isSelected = selectedFiles.some((f) => f.fullPath === file.fullPath);
            const Icon = icon.icon;
            return (
              <div
                key={file.fullPath}
                className={cn(
                  'absolute flex cursor-default items-center border-b border-transparent px-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-950',
                  isSelected && 'bg-blue-100 dark:bg-blue-900',
                )}
                style={{
                  height: virtualRow.measureElement,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={(e) => handleRowClick(e, file)}
                onDoubleClick={() => handleDoubleClick(file)}
              >
                <div className="flex w-8 justify-center">
                  {file.name === '..' ? (
                    <ArrowUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Icon className="h-4 w-4" style={{ color: icon.color }} />
                  )}
                </div>
                <div className="flex-1 truncate px-2">{file.name}</div>
                <div className="w-24 px-2 text-right text-gray-500">
                  {file.isDirectory ? '-' : formatSize(file.size)}
                </div>
                <div className="w-40 truncate px-2 text-gray-500">{file.lastModified}</div>
                {showOwner && (
                  <>
                    <div className="w-32 truncate px-2 text-gray-500">{file.owner ?? '-'}</div>
                    <div className="w-28 truncate px-2 text-gray-500">
                      {file.permissions ?? '-'}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
