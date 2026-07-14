import {
  File,
  FileCode,
  FileText,
  FileImage,
  FileArchive,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  Folder,
  Braces,
  Settings,
  Coffee,
  Container,
  Wrench,
  BookOpen,
  GitBranch,
  Package,
  Flame,
  type LucideIcon,
} from 'lucide-react';

/** 文件图标映射。 */
export interface IconMapping {
  icon: LucideIcon;
  color: string;
}

/** 根据文件名和是否目录获取图标。 */
export function getFileIcon(filename: string, isDirectory: boolean): IconMapping {
  if (isDirectory) return { icon: Folder, color: '#54AEFF' };

  const baseName = filename.split('/').pop() ?? filename;

  // 特殊文件名
  const specialNames: Record<string, IconMapping> = {
    Dockerfile: { icon: Container, color: '#2496ED' },
    Makefile: { icon: Wrench, color: '#427819' },
    README: { icon: BookOpen, color: '#083FA1' },
    'package.json': { icon: Package, color: '#CB3837' },
    '.gitignore': { icon: GitBranch, color: '#F05032' },
  };
  if (specialNames[baseName]) return specialNames[baseName];

  // 扩展名映射
  const ext = '.' + (filename.split('.').pop() ?? '').toLowerCase();
  const extMap: Record<string, IconMapping> = {
    '.rs': { icon: Flame, color: '#CE422B' },
    '.py': { icon: FileCode, color: '#3776AB' },
    '.js': { icon: FileCode, color: '#F7DF1E' },
    '.ts': { icon: FileCode, color: '#3178C6' },
    '.tsx': { icon: FileCode, color: '#3178C6' },
    '.jsx': { icon: FileCode, color: '#3178C6' },
    '.go': { icon: FileCode, color: '#00ADD8' },
    '.java': { icon: Coffee, color: '#ED8B00' },
    '.c': { icon: FileCode, color: '#A8B9CC' },
    '.cpp': { icon: FileCode, color: '#00599C' },
    '.cs': { icon: FileCode, color: '#239120' },
    '.json': { icon: Braces, color: '#F7DF1E' },
    '.yaml': { icon: FileText, color: '#CB171E' },
    '.yml': { icon: FileText, color: '#CB171E' },
    '.toml': { icon: FileText, color: '#9C4121' },
    '.xml': { icon: FileCode, color: '#0060AC' },
    '.env': { icon: Settings, color: '#ECD53F' },
    '.md': { icon: FileText, color: '#083FA1' },
    '.txt': { icon: FileText, color: '#6B7280' },
    '.html': { icon: FileCode, color: '#E34F26' },
    '.css': { icon: FileCode, color: '#1572B6' },
    '.png': { icon: FileImage, color: '#9333EA' },
    '.jpg': { icon: FileImage, color: '#9333EA' },
    '.jpeg': { icon: FileImage, color: '#9333EA' },
    '.gif': { icon: FileImage, color: '#9333EA' },
    '.svg': { icon: FileImage, color: '#9333EA' },
    '.zip': { icon: FileArchive, color: '#D97706' },
    '.tar': { icon: FileArchive, color: '#D97706' },
    '.gz': { icon: FileArchive, color: '#D97706' },
    '.7z': { icon: FileArchive, color: '#D97706' },
    '.rar': { icon: FileArchive, color: '#D97706' },
    '.mp3': { icon: FileAudio, color: '#10B981' },
    '.wav': { icon: FileAudio, color: '#10B981' },
    '.flac': { icon: FileAudio, color: '#10B981' },
    '.mp4': { icon: FileVideo, color: '#EF4444' },
    '.avi': { icon: FileVideo, color: '#EF4444' },
    '.mkv': { icon: FileVideo, color: '#EF4444' },
    '.csv': { icon: FileSpreadsheet, color: '#059669' },
    '.xls': { icon: FileSpreadsheet, color: '#059669' },
    '.xlsx': { icon: FileSpreadsheet, color: '#059669' },
  };
  if (extMap[ext]) return extMap[ext];

  return { icon: File, color: '#6B7280' };
}
