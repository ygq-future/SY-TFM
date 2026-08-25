import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkPlus, ChevronRight, FolderOpen } from 'lucide-react';
import { AnchoredPortal } from '../../components/shared/AnchoredPortal';
import { useConnectionStore } from '../../stores/connectionStore';
import type { FavoriteFolder } from '../../types/generated/FavoriteFolder';
import type { RemoteFile } from '../../types/generated/RemoteFile';
import { canAddFavoriteFolder } from './browserViewModel';

/** 当前主机的收藏文件夹入口；桌面和 Android 共用同一份主机级数据。 */
export function FavoriteFoldersMenu({
  hostId,
  onNavigate,
  mobile = false,
  selectedFiles = [],
  onAddFavorite,
}: {
  hostId: string;
  onNavigate: (path: string) => void;
  mobile?: boolean;
  selectedFiles?: RemoteFile[];
  onAddFavorite?: (files: RemoteFile[]) => void;
}) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const host = useConnectionStore((state) => state.hosts.find((item) => item.id === hostId));
  const folders = host?.favoriteFolders ?? [];

  return (
    <div
      ref={anchorRef}
      className={mobile ? 'favorite-folders favorite-folders--mobile' : 'favorite-folders'}
    >
      <button
        type="button"
        className={mobile ? 'mobile-file-action mobile-favorite-action' : 'icon-button'}
        title={t('browser.favoriteFolders')}
        aria-label={t('browser.favoriteFolders')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bookmark />
        {mobile && <span>{t('browser.favorite')}</span>}
      </button>
      {isOpen && (
        <AnchoredPortal
          anchorRef={anchorRef}
          className="favorite-folders-menu"
          role="menu"
          onClose={() => setIsOpen(false)}
        >
          <div className="favorite-folders-heading">
            <span>{t('browser.favoriteFolders')}</span>
            {host && <small>{host.name}</small>}
          </div>
          {onAddFavorite && canAddFavoriteFolder(null, selectedFiles) && (
            <button
              type="button"
              role="menuitem"
              className="favorite-folder-add"
              onClick={() => {
                setIsOpen(false);
                onAddFavorite(selectedFiles);
              }}
            >
              <BookmarkPlus />
              <span>{t('contextMenu.addFavorite')}</span>
              <small>{selectedFiles.length}</small>
            </button>
          )}
          {folders.length === 0 ? (
            <div className="favorite-folders-state">{t('browser.noFavoriteFolders')}</div>
          ) : (
            <div className="favorite-folders-list">
              {folders.map((folder) => (
                <FavoriteFolderOption
                  key={folder.path}
                  folder={folder}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate(folder.path);
                  }}
                />
              ))}
            </div>
          )}
        </AnchoredPortal>
      )}
    </div>
  );
}

function FavoriteFolderOption({
  folder,
  onClick,
}: {
  folder: FavoriteFolder;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="favorite-folder-option"
      title={folder.path}
      onClick={onClick}
    >
      <FolderOpen />
      <span>
        <strong>{folder.name}</strong>
        <small>{folder.path}</small>
      </span>
      <ChevronRight />
    </button>
  );
}
