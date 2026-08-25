import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { RemoteFile } from '../../types/generated/RemoteFile';
import {
  FILE_ROW_HEIGHT,
  buildBreadcrumbItems,
  collapseBreadcrumbItems,
  calculateTransferPercent,
  getParentRemotePath,
  getContextMenuPosition,
  canAddFavoriteFolder,
  getFavoriteFolderTargets,
  getFileContextActions,
  formatRemoteModified,
  isEditableTextFile,
  prependParentDirectory,
  normalizeRemotePath,
} from './browserViewModel';

const file = (isDirectory: boolean): RemoteFile => ({
  name: isDirectory ? 'docs' : 'notes.txt',
  fullPath: isDirectory ? '/docs' : '/notes.txt',
  size: 1,
  isDirectory,
  lastModified: '',
  owner: null,
  permissions: null,
});

describe('browser view model', () => {
  it('uses a compact, shared virtual row height', () => {
    expect(FILE_ROW_HEIGHT).toBe(27);
  });

  it('keeps a context menu beside the pointer and flips at viewport edges', () => {
    expect(getContextMenuPosition(100, 120, 190, 280, 1280, 720)).toEqual({
      left: 102,
      top: 122,
    });
    expect(getContextMenuPosition(1270, 710, 190, 280, 1280, 720)).toEqual({
      left: 1078,
      top: 428,
    });
    expect(getContextMenuPosition(4, 4, 190, 280, 180, 240)).toEqual({
      left: 8,
      top: 8,
    });
  });

  it('builds distinct file, folder, and blank-area menus', () => {
    expect(getFileContextActions(file(false))).toEqual([
      'download',
      'downloadTo',
      'remoteEdit',
      'onlineEdit',
      'rename',
      'delete',
      'refresh',
      'mkdir',
      'createFile',
    ]);
    expect(getFileContextActions(file(true))).not.toContain('remoteEdit');
    expect(getFileContextActions(file(true))).not.toContain('onlineEdit');
    expect(getFileContextActions(file(true))).toContain('favorite');
    expect(getFileContextActions(file(false), [file(false), file(true)])).not.toContain('rename');
    expect(getFileContextActions(null)).toEqual(['refresh', 'mkdir', 'createFile']);
    expect(getFileContextActions(null, [], '/home/deploy')).toEqual([
      'favorite',
      'refresh',
      'mkdir',
      'createFile',
    ]);
    expect(getFileContextActions(null, [file(true)])).toEqual([
      'favorite',
      'refresh',
      'mkdir',
      'createFile',
    ]);
  });

  it('only exposes favorites for pure directory selections', () => {
    const folderA = file(true);
    const folderB = { ...folderA, name: 'archive', fullPath: '/archive' };
    const textFile = file(false);

    expect(canAddFavoriteFolder(folderA, [folderA])).toBe(true);
    expect(canAddFavoriteFolder(folderA, [folderA, folderB])).toBe(true);
    expect(canAddFavoriteFolder(textFile, [textFile])).toBe(false);
    expect(canAddFavoriteFolder(folderA, [folderA, textFile])).toBe(false);
    expect(canAddFavoriteFolder(null, [])).toBe(false);
    expect(canAddFavoriteFolder(null, [folderA, folderB])).toBe(true);
    expect(getFavoriteFolderTargets(folderA, [folderA, folderB])).toEqual([folderA, folderB]);
    expect(getFavoriteFolderTargets(null, [], '/home/deploy')).toMatchObject([
      { name: 'deploy', fullPath: '/home/deploy', isDirectory: true },
    ]);
    expect(getFileContextActions(folderA, [folderA, textFile])).not.toContain('favorite');
    expect(getFileContextActions(textFile, [textFile])).not.toContain('favorite');
  });

  it('collapses only the middle of a long path and keeps every hidden level navigable', () => {
    const items = buildBreadcrumbItems('/home/deploy/apps/releases/current');
    expect(collapseBreadcrumbItems(items)).toEqual({
      visible: [
        { label: '/', path: '/' },
        { label: 'home', path: '/home' },
        { label: 'current', path: '/home/deploy/apps/releases/current' },
      ],
      hidden: [
        { label: 'deploy', path: '/home/deploy' },
        { label: 'apps', path: '/home/deploy/apps' },
        { label: 'releases', path: '/home/deploy/apps/releases' },
      ],
    });
    expect(collapseBreadcrumbItems(buildBreadcrumbItems('/home/deploy'))).toEqual({
      visible: buildBreadcrumbItems('/home/deploy'),
      hidden: [],
    });
    expect(collapseBreadcrumbItems(buildBreadcrumbItems('/home/deploy/releases')).hidden).toEqual([
      { label: 'deploy', path: '/home/deploy' },
    ]);
  });

  it('normalizes edited paths to a single rooted path', () => {
    expect(normalizeRemotePath(' home//deploy ')).toBe('/home/deploy');
    expect(normalizeRemotePath('')).toBe('/');
  });

  it('keeps Windows SSH paths segmented and navigable', () => {
    expect(normalizeRemotePath('E:\\Library\\Downloads\\SY-TFM')).toBe(
      'E:\\Library\\Downloads\\SY-TFM',
    );
    expect(buildBreadcrumbItems('E:\\Library\\Downloads\\SY-TFM')).toEqual([
      { label: 'E:', path: 'E:\\' },
      { label: 'Library', path: 'E:\\Library' },
      { label: 'Downloads', path: 'E:\\Library\\Downloads' },
      { label: 'SY-TFM', path: 'E:\\Library\\Downloads\\SY-TFM' },
    ]);
    expect(getParentRemotePath('E:\\Library\\Downloads')).toBe('E:\\Library');
    expect(normalizeRemotePath('/E:\\Library\\Downloads')).toBe('E:\\Library\\Downloads');
  });

  it('prepends a parent directory entry at every level', () => {
    const files = [file(true), file(false)];
    expect(prependParentDirectory(files, '/home/deploy')[0]).toMatchObject({
      name: '..',
      fullPath: '/home',
      isDirectory: true,
    });
    expect(prependParentDirectory(files, '/')[0]?.fullPath).toBe('/');
  });

  it('uses the shared height for virtualization and delays drag activation', () => {
    const source = readFileSync(new URL('./FileList.tsx', import.meta.url), 'utf8');
    expect(source).toContain('estimateSize: () => FILE_ROW_HEIGHT');
    expect(source).toContain("width: '100%'");
    expect(source).toContain('top: virtualStart');
    expect(source).not.toContain('translateY(${virtualStart}px)');
    expect(source).not.toContain('<DndContext');
    expect(source).toMatch(/kind:\s*'blocked'[\s\S]*?targetDirectory:\s*currentPath/);
    expect(source).not.toContain("t('browser.folderType')");
  });

  it('keeps all metadata columns visible in dual-pane mode', () => {
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(css).not.toMatch(/\.workspace-panels--dual \.file-date-cell,[\s\S]*?display:\s*none/);
    expect(css).toContain('.workspace-panels--dual .file-list--with-owner .file-row');
    expect(css).toContain('--file-size-width: 60px');
    expect(css).toContain('--file-owner-width: 70px');
    expect(css).toContain('--file-permission-width: 96px');
    expect(css).toContain('--file-date-width: 118px');
  });

  it('keeps task progress monotonic and reserves 100 percent for actual completion', () => {
    const firstFile = calculateTransferPercent(0, 1, 2, 100, 'localToRemote', 'upload');
    expect(firstFile).toBeCloseTo(49.75);
    expect(calculateTransferPercent(firstFile, 2, 2, 0, 'localToRemote', 'upload')).toBe(50);

    const relayDownload = calculateTransferPercent(0, 1, 1, 100, 'remoteToRemote', 'download');
    const relayUpload = calculateTransferPercent(
      relayDownload,
      1,
      1,
      0,
      'remoteToRemote',
      'upload',
    );
    expect(relayDownload).toBeCloseTo(49.75);
    expect(relayUpload).toBe(50);
    expect(
      calculateTransferPercent(relayUpload, 1, 1, 100, 'remoteToRemote', 'upload'),
    ).toBeCloseTo(99.5);
  });

  it('formats WebDAV HTTP dates compactly and rejects binary editor targets', () => {
    expect(formatRemoteModified('Sun, 12 Jul 2026 18:54:16 GMT')).toMatch(
      /^2026-07-1[23] \d{2}:\d{2}$/,
    );
    expect(formatRemoteModified('')).toBe('-');
    expect(isEditableTextFile('notes.md')).toBe(true);
    expect(isEditableTextFile('Dockerfile')).toBe(true);
    expect(isEditableTextFile('殭屍.2013.BDRip.mkv')).toBe(false);
  });

  it('measures the available breadcrumb width before collapsing', () => {
    const source = readFileSync(new URL('./Breadcrumb.tsx', import.meta.url), 'utf8');
    expect(source).toContain('new ResizeObserver');
    expect(source).toContain('measure.scrollWidth > nav.clientWidth');
    expect(source).toContain('setSelectionRange(value.length, value.length)');
    expect(source).not.toContain('.select()');
    expect(source).not.toContain('<small>{hiddenItem.path}</small>');
  });
});
