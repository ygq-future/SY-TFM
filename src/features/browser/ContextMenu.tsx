import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Code2,
  Download,
  FileDown,
  FilePenLine,
  FilePlus,
  FolderPlus,
  BookmarkPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { RemoteFile } from '../../types/generated/RemoteFile';
import { ModalPortal } from '../../components/shared/ModalPortal';
import {
  getContextMenuPosition,
  getFavoriteFolderTargets,
  getFileContextActions,
  type FileContextAction,
} from './browserViewModel';

/** 右键上下文菜单。 */
export function ContextMenu({
  x,
  y,
  file,
  selectedFiles,
  currentPath,
  onClose,
  onMkdir,
  onCreateFile,
  onRename,
  onDelete,
  onDownload,
  onDownloadTo,
  onRefresh,
  onRemoteEdit,
  onOnlineEdit,
  onAddFavorite,
}: {
  x: number;
  y: number;
  file: RemoteFile | null;
  selectedFiles: RemoteFile[];
  currentPath: string;
  onClose: () => void;
  onMkdir: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDownloadTo: () => void;
  onRefresh: () => void;
  onRemoteEdit: () => void;
  onOnlineEdit: () => void;
  onAddFavorite: (files: RemoteFile[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x + 2, top: y + 2 });
  const actions = getFileContextActions(file, selectedFiles, currentPath);
  const favoriteTargets = getFavoriteFolderTargets(file, selectedFiles, currentPath);

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (!ref.current) return;
      const bounds = ref.current.getBoundingClientRect();
      setPosition(
        getContextMenuPosition(
          x,
          y,
          bounds.width,
          bounds.height,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [actions.length, x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <ModalPortal>
      <div ref={ref} className="context-menu" role="menu" style={position}>
        {actions.map((action, index) => (
          <MenuAction
            key={action}
            action={action}
            dividerBefore={action === 'refresh' && index > 0}
            onRun={(selectedAction) => {
              const handlers: Partial<Record<FileContextAction, () => void>> = {
                download: onDownload,
                downloadTo: onDownloadTo,
                favorite: () => onAddFavorite(favoriteTargets),
                remoteEdit: onRemoteEdit,
                onlineEdit: onOnlineEdit,
                rename: onRename,
                delete: onDelete,
                refresh: onRefresh,
                mkdir: onMkdir,
                createFile: onCreateFile,
              };
              const handler = handlers[selectedAction];
              if (handler) run(handler);
            }}
          />
        ))}
      </div>
    </ModalPortal>
  );
}

const menuPresentation: Record<
  FileContextAction,
  {
    icon: React.ComponentType<{ className?: string }>;
    labelKey: string;
    danger?: boolean;
    shortcut?: string;
  }
> = {
  download: { icon: Download, labelKey: 'contextMenu.download' },
  downloadTo: { icon: FileDown, labelKey: 'contextMenu.downloadTo' },
  favorite: { icon: BookmarkPlus, labelKey: 'contextMenu.addFavorite' },
  remoteEdit: { icon: FilePenLine, labelKey: 'contextMenu.remoteEdit' },
  onlineEdit: { icon: Code2, labelKey: 'contextMenu.onlineEdit' },
  rename: { icon: Pencil, labelKey: 'contextMenu.rename', shortcut: 'F2' },
  delete: { icon: Trash2, labelKey: 'contextMenu.delete', danger: true, shortcut: 'Del' },
  refresh: { icon: RefreshCw, labelKey: 'contextMenu.refresh' },
  mkdir: { icon: FolderPlus, labelKey: 'contextMenu.newFolder' },
  createFile: { icon: FilePlus, labelKey: 'contextMenu.newFile' },
};

function MenuAction({
  action,
  dividerBefore,
  onRun,
}: {
  action: FileContextAction;
  dividerBefore: boolean;
  onRun: (action: FileContextAction) => void;
}) {
  const { t } = useTranslation();
  const item = menuPresentation[action];
  return (
    <>
      {dividerBefore && <Divider />}
      <MenuItem
        icon={item.icon}
        label={t(item.labelKey)}
        hint={item.shortcut}
        danger={item.danger}
        onClick={() => onRun(action)}
      />
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? 'context-item context-item--danger' : 'context-item'}
      onClick={onClick}
    >
      <Icon />
      <span>{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
}

function Divider() {
  return <div className="context-divider" />;
}
