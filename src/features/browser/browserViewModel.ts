import type { RemoteFile } from '../../types/generated/RemoteFile';
import type { TransferDirection } from '../../types/enums/TransferDirection';

/** 文件列表统一行高，虚拟定位和视觉布局必须共用此值。 */
export const FILE_ROW_HEIGHT = 27;

const EDITABLE_TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'xml',
  'csv',
  'tsv',
  'ini',
  'conf',
  'config',
  'log',
  'css',
  'scss',
  'sass',
  'less',
  'html',
  'htm',
  'js',
  'jsx',
  'ts',
  'tsx',
  'vue',
  'svelte',
  'py',
  'rs',
  'go',
  'java',
  'kt',
  'kts',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'rb',
  'swift',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'cmd',
  'sql',
  'graphql',
  'proto',
  'dockerfile',
]);

const EDITABLE_TEXT_NAMES = new Set([
  'dockerfile',
  'makefile',
  'jenkinsfile',
  'procfile',
  'readme',
  'license',
  'changelog',
  'authors',
  'notice',
  '.gitignore',
  '.gitattributes',
  '.gitconfig',
  '.editorconfig',
  '.env',
  '.npmrc',
  '.bashrc',
  '.zshrc',
  '.profile',
]);

/** 判断文件是否适合进入文本编辑流程，避免读取视频等二进制内容。 */
export function isEditableTextFile(filename: string): boolean {
  const normalized = filename.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  if (EDITABLE_TEXT_NAMES.has(normalized)) return true;
  const separator = normalized.lastIndexOf('.');
  return separator >= 0 && EDITABLE_TEXT_EXTENSIONS.has(normalized.slice(separator + 1));
}

/** 将 WebDAV HTTP-date 与 SFTP 时间统一成紧凑的本地时间。 */
export function formatRemoteModified(value: string): string {
  if (!value.trim()) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 将单个文件或中转阶段的进度映射为整个任务的单调进度。
 * 100% 只由任务完成流程写入，避免子文件完成后进度再次归零。
 */
export function calculateTransferPercent(
  currentPercent: number,
  currentIndex: number,
  totalCount: number,
  filePercent: number,
  direction: TransferDirection | null,
  phase: 'download' | 'upload',
): number {
  const total = Math.max(1, totalCount);
  const index = Math.min(total, Math.max(1, currentIndex));
  const boundedFilePercent = Math.min(99.5, Math.max(0, filePercent));
  const completedItems = index - 1;
  const phaseOffset = direction === 'remoteToRemote' && phase === 'upload' ? 0.5 : 0;
  const phaseScale = direction === 'remoteToRemote' ? 0.5 : 1;
  const candidate =
    ((completedItems + phaseOffset + (boundedFilePercent / 100) * phaseScale) / total) * 100;
  return Math.min(99.5, Math.max(currentPercent, candidate));
}

/** 让右键菜单紧贴指针，并在视口边缘自动翻转到指针另一侧。 */
export function getContextMenuPosition(
  anchorX: number,
  anchorY: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  const margin = 8;
  const pointerGap = 2;
  const right = anchorX + pointerGap;
  const left = anchorX - menuWidth - pointerGap;
  const below = anchorY + pointerGap;
  const above = anchorY - menuHeight - pointerGap;

  return {
    left:
      right + menuWidth <= viewportWidth - margin
        ? Math.max(margin, right)
        : left >= margin
          ? left
          : margin,
    top:
      below + menuHeight <= viewportHeight - margin
        ? Math.max(margin, below)
        : above >= margin
          ? above
          : margin,
  };
}

/** 文件右键菜单动作标识。 */
export type FileContextAction =
  | 'download'
  | 'downloadTo'
  | 'remoteEdit'
  | 'onlineEdit'
  | 'rename'
  | 'delete'
  | 'refresh'
  | 'mkdir'
  | 'createFile';

/** 根据命中目标生成稳定的菜单结构。 */
export function getFileContextActions(
  file: RemoteFile | null,
  selectionCount = 1,
): FileContextAction[] {
  if (!file || file.name === '..') return ['refresh', 'mkdir', 'createFile'];

  const common: FileContextAction[] = ['download', 'downloadTo'];
  if (!file.isDirectory) common.push('remoteEdit', 'onlineEdit');
  const singleSelectionActions: FileContextAction[] = selectionCount === 1 ? ['rename'] : [];
  return [...common, ...singleSelectionActions, 'delete', 'refresh', 'mkdir', 'createFile'];
}

/** 面包屑路径节点。 */
export interface BreadcrumbItem {
  label: string;
  path: string;
}

/** 将绝对路径转换为可导航的面包屑节点。 */
export function buildBreadcrumbItems(path: string): BreadcrumbItem[] {
  const normalized = normalizeRemotePath(path);
  const windowsMatch = /^([A-Za-z]:)\\(.*)$/.exec(normalized);
  if (windowsMatch) {
    const drive = windowsMatch[1];
    const segments = windowsMatch[2].split('\\').filter(Boolean);
    return [
      { label: drive, path: `${drive}\\` },
      ...segments.map((segment, index) => ({
        label: segment,
        path: `${drive}\\${segments.slice(0, index + 1).join('\\')}`,
      })),
    ];
  }
  const segments = normalized.split('/').filter(Boolean);
  return [
    { label: '/', path: '/' },
    ...segments.map((segment, index) => ({
      label: segment,
      path: `/${segments.slice(0, index + 1).join('/')}`,
    })),
  ];
}

/** 长路径保留根、首段和末段，其余节点收纳进省略菜单。 */
export function collapseBreadcrumbItems(items: BreadcrumbItem[]): {
  visible: BreadcrumbItem[];
  hidden: BreadcrumbItem[];
} {
  if (items.length <= 3) return { visible: items, hidden: [] };
  return {
    visible: [items[0], items[1], items[items.length - 1]],
    hidden: items.slice(2, -1),
  };
}

/** 规范化用户输入的绝对路径。 */
export function normalizeRemotePath(path: string): string {
  const value = path.trim();
  const trimmed = /^\/[A-Za-z]:[\\/]/.test(value) ? value.slice(1) : value;
  if (!trimmed) return '/';
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    const windowsPath = trimmed.replace(/\//g, '\\').replace(/\\{2,}/g, '\\');
    return windowsPath.length === 2 ? `${windowsPath}\\` : windowsPath;
  }
  const withRoot = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withRoot.replace(/\/{2,}/g, '/');
}

/** 返回远程路径的父目录，同时兼容 POSIX 与 Windows OpenSSH。 */
export function getParentRemotePath(path: string): string {
  const normalized = normalizeRemotePath(path);
  if (/^[A-Za-z]:\\/.test(normalized)) {
    const driveRoot = normalized.slice(0, 3);
    if (normalized === driveRoot) return driveRoot;
    const index = normalized.lastIndexOf('\\');
    return index <= 2 ? driveRoot : normalized.slice(0, index);
  }
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '/' : normalized.slice(0, index);
}

/** 拼接远程路径，不把 Windows 反斜杠路径误改成 POSIX 路径。 */
export function joinRemotePath(parent: string, name: string): string {
  const normalized = normalizeRemotePath(parent);
  const separator = /^[A-Za-z]:\\/.test(normalized) ? '\\' : '/';
  return `${normalized.replace(/[\\/]$/, '')}${separator}${name}`;
}

/** 在目录内容顶部添加稳定的“上一级”虚拟目录。 */
export function prependParentDirectory(files: RemoteFile[], currentPath: string): RemoteFile[] {
  const contents = files.filter((file) => file.name !== '.' && file.name !== '..');
  return [
    {
      name: '..',
      fullPath: getParentRemotePath(currentPath),
      size: 0,
      isDirectory: true,
      lastModified: '',
      owner: null,
      permissions: null,
    },
    ...contents,
  ];
}
