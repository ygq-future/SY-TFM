import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, HardDrive, MoreHorizontal, Pencil } from 'lucide-react';
import {
  buildBreadcrumbItems,
  collapseBreadcrumbItems,
  normalizeRemotePath,
} from './browserViewModel';
import { AnchoredPortal } from '../../components/shared/AnchoredPortal';

function moveCaretToPathEnd(input: HTMLInputElement): void {
  const { value } = input;
  input.setSelectionRange(value.length, value.length);
}

/** 支持中间路径折叠与完整路径编辑的面包屑。 */
export function Breadcrumb({
  path,
  isEditing,
  onEditingChange,
  onNavigate,
}: {
  path: string;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [draftPath, setDraftPath] = useState(path);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const items = buildBreadcrumbItems(path);
  const { visible, hidden } = isOverflowing
    ? collapseBreadcrumbItems(items)
    : { visible: items, hidden: [] };

  useEffect(() => setDraftPath(path), [path]);
  useLayoutEffect(() => {
    if (!isEditing) return;
    const frame = window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      moveCaretToPathEnd(input);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isEditing]);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure || isEditing) return;
    const updateOverflow = () => setIsOverflowing(measure.scrollWidth > nav.clientWidth + 1);
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [isEditing, path]);

  const submitPath = () => {
    const nextPath = normalizeRemotePath(draftPath);
    onEditingChange(false);
    onNavigate(nextPath);
  };

  return (
    <nav
      ref={navRef}
      className={isEditing ? 'breadcrumb breadcrumb--editing' : 'breadcrumb'}
      aria-label={t('browser.currentPath')}
      title={t('browser.editFullPath')}
      onDoubleClick={() => onEditingChange(true)}
    >
      {isEditing ? (
        <form
          className="breadcrumb-editor"
          onSubmit={(event) => {
            event.preventDefault();
            submitPath();
          }}
        >
          <HardDrive />
          <input
            ref={inputRef}
            value={draftPath}
            aria-label={t('browser.fullRemotePath')}
            autoFocus
            onFocus={(event) => moveCaretToPathEnd(event.currentTarget)}
            onChange={(event) => setDraftPath(event.target.value)}
            onBlur={submitPath}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDraftPath(path);
                onEditingChange(false);
              }
            }}
          />
        </form>
      ) : (
        <>
          <div className="breadcrumb-measure" ref={measureRef} aria-hidden="true">
            {items.map((item, index) => (
              <Fragment key={item.path}>
                {index > 0 && <ChevronRight className="breadcrumb-divider" />}
                <span className="breadcrumb-item">{item.label}</span>
              </Fragment>
            ))}
          </div>
          {visible.map((item, index) => (
            <Fragment key={item.path}>
              {index > 0 && <ChevronRight className="breadcrumb-divider" />}
              {hidden.length > 0 && index === visible.length - 1 && (
                <>
                  <div className="breadcrumb-overflow" ref={overflowRef}>
                    <button
                      className="breadcrumb-item breadcrumb-more"
                      type="button"
                      aria-label={t('browser.showCollapsed')}
                      aria-expanded={isOverflowOpen}
                      onClick={() => setIsOverflowOpen((open) => !open)}
                    >
                      <MoreHorizontal />
                    </button>
                    {isOverflowOpen && (
                      <AnchoredPortal
                        anchorRef={overflowRef}
                        className="breadcrumb-menu"
                        role="menu"
                        onClose={() => setIsOverflowOpen(false)}
                      >
                        {hidden.map((hiddenItem) => (
                          <button
                            key={hiddenItem.path}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsOverflowOpen(false);
                              onNavigate(hiddenItem.path);
                            }}
                          >
                            <span>{hiddenItem.label}</span>
                          </button>
                        ))}
                      </AnchoredPortal>
                    )}
                  </div>
                  <ChevronRight className="breadcrumb-divider" />
                </>
              )}
              <button
                type="button"
                className={
                  index === visible.length - 1
                    ? 'breadcrumb-item breadcrumb-item--current'
                    : 'breadcrumb-item'
                }
                onClick={() => onNavigate(item.path)}
              >
                {index === 0 && <HardDrive />}
                <span>{item.label}</span>
              </button>
            </Fragment>
          ))}
        </>
      )}
      {!isEditing && (
        <button
          className="breadcrumb-edit-button"
          type="button"
          aria-label={t('browser.editPath')}
          title={t('browser.editFullPath')}
          onClick={(event) => {
            event.stopPropagation();
            onEditingChange(true);
          }}
        >
          <Pencil />
        </button>
      )}
    </nav>
  );
}
