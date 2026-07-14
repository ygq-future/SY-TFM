import { useEffect, useRef } from 'react';
import { FolderPlus, FilePlus, Pencil, Trash2, Download, Upload } from 'lucide-react';
import type { RemoteFile } from '../../types/generated/RemoteFile';

/** 右键上下文菜单。 */
export function ContextMenu({
  x,
  y,
  file,
  onClose,
  onMkdir,
  onCreateFile,
  onRename,
  onDelete,
  onDownload,
  onUpload,
}: {
  x: number;
  y: number;
  file: RemoteFile | null;
  onClose: () => void;
  onMkdir: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onUpload: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 调整位置避免溢出视窗
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 280);

  const hasFile = file !== null && file.name !== '..';

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-md border bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <MenuItem
        icon={FolderPlus}
        label="新建文件夹"
        onClick={() => {
          onMkdir();
          onClose();
        }}
      />
      <MenuItem
        icon={FilePlus}
        label="新建文件"
        onClick={() => {
          onCreateFile();
          onClose();
        }}
      />
      <Divider />
      {hasFile && (
        <MenuItem
          icon={Pencil}
          label="重命名"
          onClick={() => {
            onRename();
            onClose();
          }}
        />
      )}
      {hasFile && (
        <MenuItem
          icon={Download}
          label="下载"
          onClick={() => {
            onDownload();
            onClose();
          }}
        />
      )}
      <MenuItem
        icon={Upload}
        label="上传到此处"
        onClick={() => {
          onUpload();
          onClose();
        }}
      />
      {hasFile && <Divider />}
      {hasFile && (
        <MenuItem
          icon={Trash2}
          label="删除"
          danger
          onClick={() => {
            onDelete();
            onClose();
          }}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
        danger ? 'text-red-500' : ''
      }`}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-gray-100 dark:border-gray-700" />;
}
