import { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import type { RemoteFile } from '../../types/generated/RemoteFile';
import type { AdapterCapability } from '../../types/enums/AdapterCapability';
import { getFileIcon } from '../../lib/fileIcons';
import { cn } from '../../lib/utils';
import type { SortColumn } from '../../types/enums/SortColumn';
import { FILE_ROW_HEIGHT, formatRemoteModified } from './browserViewModel';
import type { PaneIndex } from '../../stores/browserStore';

/** 能力位标志常量（对应 Rust AdapterCapability bitflags）。 */
const CAP_OWNER_PERMISSIONS = 1 << 0;
const FILE_TABLE_HEADER_HEIGHT = 30;

/** 跨面板拖拽源数据。 */
export interface FileDragData {
  kind: 'file';
  paneIndex: PaneIndex;
  hostId: string;
  file: RemoteFile;
}

/** 跨面板目录落点数据。 */
export interface DirectoryDropData {
  kind: 'directory';
  paneIndex: PaneIndex;
  hostId: string;
  targetDirectory: string;
}

/** 面板当前目录落点数据。 */
export interface PaneDropData {
  kind: 'pane';
  paneIndex: PaneIndex;
  hostId: string;
  targetDirectory: string;
}

/** 普通文件占位落点：阻止父面板把文件行误判为空白目录区域。 */
export interface BlockedDropData {
  kind: 'blocked';
  paneIndex: PaneIndex;
  hostId: string;
  targetDirectory: string;
}

/** 文件列表内所有可能的落点数据。 */
export type FileDropData = DirectoryDropData | PaneDropData | BlockedDropData;

/** 格式化文件大小。 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function DndFileRow({
  file,
  index,
  virtualStart,
  virtualSize,
  className,
  onClick,
  onDoubleClick,
  onContextMenu,
  children,
  paneIndex,
  hostId,
  currentPath,
}: {
  file: RemoteFile;
  index: number;
  virtualStart: number;
  virtualSize: number;
  className: string;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  children: ReactNode;
  paneIndex: PaneIndex;
  hostId: string;
  currentPath: string;
}) {
  const { t } = useTranslation();
  const { active } = useDndContext();
  const activeSource = active?.data.current as FileDragData | undefined;
  const isCrossHost = activeSource?.kind === 'file' && activeSource.hostId !== hostId;
  const draggable = useDraggable({
    id: `file:${paneIndex}:${hostId}:${file.fullPath}`,
    data: { kind: 'file', paneIndex, hostId, file } satisfies FileDragData,
    disabled: file.name === '..',
  });
  const droppable = useDroppable({
    id: `${file.isDirectory ? 'directory' : 'blocked'}:${paneIndex}:${hostId}:${file.fullPath}`,
    data: file.isDirectory
      ? ({
          kind: 'directory',
          paneIndex,
          hostId,
          targetDirectory: file.fullPath,
        } satisfies DirectoryDropData)
      : ({
          kind: 'blocked',
          paneIndex,
          hostId,
          targetDirectory: currentPath,
        } satisfies BlockedDropData),
  });
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      draggable.setNodeRef(node);
      droppable.setNodeRef(node);
    },
    [draggable, droppable],
  );
  return (
    <div
      ref={setNodeRef}
      data-file-index={index}
      className={cn(className, droppable.isOver && file.isDirectory && 'file-row--drop-target')}
      style={{
        height: virtualSize,
        top: virtualStart,
        left: 0,
        width: '100%',
        opacity: draggable.isDragging ? 0.35 : undefined,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      {children}
      {droppable.isOver && file.isDirectory && (
        <span className="file-drop-hint">
          {file.name === '..'
            ? t(isCrossHost ? 'browser.copyToParent' : 'browser.dropToParent')
            : t(isCrossHost ? 'browser.copyInto' : 'browser.dropInto', { name: file.name })}
        </span>
      )}
    </div>
  );
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
  onContextMenu,
  paneIndex,
  hostId,
  currentPath,
}: {
  files: RemoteFile[];
  capabilities: AdapterCapability | null;
  onOpen: (file: RemoteFile) => void;
  onSelect: (files: RemoteFile[]) => void;
  selectedFiles: RemoteFile[];
  onSort: (column: SortColumn) => void;
  sortColumn: SortColumn;
  sortOrder: 'ascending' | 'descending';
  onContextMenu: (event: React.MouseEvent, file: RemoteFile) => void;
  paneIndex: PaneIndex;
  hostId: string;
  currentPath: string;
}) {
  const { t } = useTranslation();
  const { active, over } = useDndContext();
  const activeSource = active?.data.current as FileDragData | undefined;
  const activeTarget = over?.data.current as FileDropData | undefined;
  const isCrossHost = activeSource?.kind === 'file' && activeSource.hostId !== hostId;
  const parentRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(currentPath);
  const selectionCleanupRef = useRef<(() => void) | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const showOwner = capabilities !== null && (capabilities & CAP_OWNER_PERMISSIONS) !== 0;
  const selectableFiles = files.filter((file) => file.name !== '..');
  const allFilesSelected =
    selectableFiles.length > 0 &&
    selectableFiles.every((file) =>
      selectedFiles.some((selected) => selected.fullPath === file.fullPath),
    );
  const paneDroppable = useDroppable({
    id: `pane:${paneIndex}:${hostId}`,
    data: {
      kind: 'pane',
      paneIndex,
      hostId,
      targetDirectory: currentPath,
    } satisfies PaneDropData,
  });
  const isCurrentDirectoryDropTarget =
    paneDroppable.isOver ||
    (activeTarget?.kind === 'blocked' &&
      activeTarget.paneIndex === paneIndex &&
      activeTarget.hostId === hostId);
  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      paneDroppable.setNodeRef(node);
    },
    [paneDroppable],
  );

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => FILE_ROW_HEIGHT,
    paddingStart: FILE_TABLE_HEADER_HEIGHT,
    overscan: 10,
  });

  useLayoutEffect(() => {
    if (previousPathRef.current === currentPath) return;
    previousPathRef.current = currentPath;
    const parent = parentRef.current;
    if (parent) parent.scrollTop = 0;
  }, [currentPath]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent, file: RemoteFile, index: number) => {
      if (e.shiftKey && lastSelectedIndexRef.current !== null) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        onSelect(files.slice(start, end + 1).filter((entry) => entry.name !== '..'));
      } else if (e.ctrlKey || e.metaKey) {
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
      lastSelectedIndexRef.current = index;
    },
    [files, selectedFiles, onSelect],
  );

  const handleSelectionPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (document.documentElement.classList.contains('mobile-platform')) return;
      if (event.button !== 0 || event.target !== event.currentTarget) return;
      const parent = parentRef.current;
      if (!parent) return;

      onSelect([]);
      lastSelectedIndexRef.current = null;
      selectionCleanupRef.current?.();
      const startX = event.clientX;
      const startY = event.clientY;
      const parentRect = parent.getBoundingClientRect();

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const clientLeft = Math.min(startX, moveEvent.clientX);
        const clientTop = Math.min(startY, moveEvent.clientY);
        const clientRight = Math.max(startX, moveEvent.clientX);
        const clientBottom = Math.max(startY, moveEvent.clientY);
        setSelectionBox({
          left: clientLeft - parentRect.left + parent.scrollLeft,
          top: clientTop - parentRect.top + parent.scrollTop,
          width: clientRight - clientLeft,
          height: clientBottom - clientTop,
        });

        const selected = Array.from(parent.querySelectorAll<HTMLElement>('[data-file-index]'))
          .filter((row) => {
            const rect = row.getBoundingClientRect();
            return !(
              rect.right < clientLeft ||
              rect.left > clientRight ||
              rect.bottom < clientTop ||
              rect.top > clientBottom
            );
          })
          .map((row) => files[Number(row.dataset.fileIndex)])
          .filter((file): file is RemoteFile => Boolean(file && file.name !== '..'));
        onSelect(selected);
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
        setSelectionBox(null);
        selectionCleanupRef.current = null;
      };
      selectionCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', cleanup);
      window.addEventListener('pointercancel', cleanup);
    },
    [files, onSelect],
  );

  useEffect(() => () => selectionCleanupRef.current?.(), []);

  const handleDoubleClick = useCallback(
    (file: RemoteFile) => {
      onOpen(file);
    },
    [onOpen],
  );

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <button
      className="file-sort-button"
      type="button"
      aria-pressed={sortColumn === column}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSort(column);
      }}
    >
      {label}
      {sortColumn === column && (sortOrder === 'ascending' ? <ChevronUp /> : <ChevronDown />)}
    </button>
  );

  return (
    <div
      className={cn(
        'file-list',
        showOwner && 'file-list--with-owner',
        isCurrentDirectoryDropTarget && 'file-list--drop-target',
      )}
    >
      {isCurrentDirectoryDropTarget && (
        <span className="file-list-drop-hint">
          {t(isCrossHost ? 'browser.copyToCurrent' : 'browser.moveToCurrent')}
        </span>
      )}
      <div ref={setScrollRef} className="file-scroll-area">
        <div className="file-table-header">
          <div className="mobile-file-checkbox mobile-select-all">
            <input
              type="checkbox"
              aria-label={t('browser.selectAll')}
              checked={allFilesSelected}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onSelect(event.target.checked ? selectableFiles : [])}
            />
          </div>
          <div className="file-name-header">
            <SortHeader column="name" label={t('browser.name')} />
          </div>
          <div className="file-size-cell">
            <SortHeader column="size" label={t('browser.size')} />
          </div>
          {showOwner && (
            <>
              <div className="file-owner-cell">
                <span className="file-column-label">{t('browser.owner')}</span>
              </div>
              <div className="file-permission-cell">
                <span className="file-column-label">{t('browser.permissions')}</span>
              </div>
            </>
          )}
          <div className="file-date-cell">
            <SortHeader column="lastModified" label={t('browser.modified')} />
          </div>
        </div>
        <div
          className="file-virtual-surface relative min-h-full select-none"
          style={{ height: virtualizer.getTotalSize() }}
          onPointerDown={handleSelectionPointerDown}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const file = files[virtualRow.index];
            if (!file) return null;
            const icon = getFileIcon(file.name, file.isDirectory);
            const isSelected = selectedFiles.some((f) => f.fullPath === file.fullPath);
            const Icon = icon.icon;
            return (
              <DndFileRow
                key={file.fullPath}
                file={file}
                index={virtualRow.index}
                virtualStart={virtualRow.start}
                virtualSize={virtualRow.size}
                paneIndex={paneIndex}
                hostId={hostId}
                currentPath={currentPath}
                className={cn('file-row', isSelected && 'file-row--selected')}
                onClick={(e) => handleRowClick(e, file, virtualRow.index)}
                onDoubleClick={() => handleDoubleClick(file)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (document.documentElement.classList.contains('mobile-platform')) return;
                  if (!isSelected) onSelect([file]);
                  onContextMenu(event, file);
                }}
              >
                <div className="mobile-file-checkbox">
                  {file.name !== '..' && (
                    <input
                      type="checkbox"
                      aria-label={t('browser.selectFile', { name: file.name })}
                      checked={isSelected}
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        onSelect(
                          event.target.checked
                            ? [...selectedFiles, file]
                            : selectedFiles.filter(
                                (selected) => selected.fullPath !== file.fullPath,
                              ),
                        );
                      }}
                    />
                  )}
                </div>
                <div className="file-icon-cell">
                  {file.name === '..' ? (
                    <ArrowUp className="file-up-icon" />
                  ) : (
                    <span className="file-icon-tile">
                      <Icon style={{ color: icon.color }} />
                    </span>
                  )}
                </div>
                <div className="file-name-cell">
                  <span>{file.name}</span>
                </div>
                <div className="file-size-cell">
                  {file.isDirectory ? '-' : formatSize(file.size)}
                </div>
                {showOwner && (
                  <>
                    <div className="file-owner-cell">{file.owner ?? '-'}</div>
                    <div className="file-permission-cell">{file.permissions ?? '-'}</div>
                  </>
                )}
                <div className="file-date-cell">{formatRemoteModified(file.lastModified)}</div>
              </DndFileRow>
            );
          })}
          {selectionBox && <div className="selection-box" style={selectionBox} />}
        </div>
      </div>
    </div>
  );
}
