import { describe, it, expect } from 'vitest';
import { getFileIcon } from './fileIcons';
import {
  Atom,
  Blocks,
  Braces,
  Container,
  Database,
  File,
  FileArchive,
  FileImage,
  FileJson2,
  FileKey2,
  FileTerminal,
  FileType2,
  FlaskConical,
  Folder,
  PackageOpen,
  Presentation,
} from 'lucide-react';

describe('getFileIcon', () => {
  it('目录返回 Folder 图标', () => {
    const result = getFileIcon('mydir', true);
    expect(result.icon).toBe(Folder);
    expect(result.color).toBe('#54AEFF');
  });

  it('Dockerfile 返回 Container 图标', () => {
    const result = getFileIcon('Dockerfile', false);
    expect(result.icon).not.toBe(File);
  });

  it('package.json 返回 Package 图标', () => {
    const result = getFileIcon('package.json', false);
    expect(result.icon).not.toBe(File);
  });

  it('.py 文件返回语言图标', () => {
    const result = getFileIcon('script.py', false);
    expect(result.icon).toBe(FlaskConical);
  });

  it('.jpg 文件返回图片图标', () => {
    const result = getFileIcon('photo.jpg', false);
    expect(result.icon).toBe(FileImage);
  });

  it('.zip 文件返回压缩包图标', () => {
    const result = getFileIcon('archive.zip', false);
    expect(result.icon).toBe(FileArchive);
  });

  it('未知扩展名返回默认文件图标', () => {
    const result = getFileIcon('unknown.xyz', false);
    expect(result.icon).toBe(File);
  });

  it('带路径的文件名正确提取扩展名', () => {
    const result = getFileIcon('/path/to/image.png', false);
    expect(result.icon).toBe(FileImage);
  });

  it('为结构化、终端、数据库和密钥文件提供不同图标', () => {
    expect(getFileIcon('settings.json', false).icon).toBe(FileJson2);
    expect(getFileIcon('deploy.sh', false).icon).toBe(FileTerminal);
    expect(getFileIcon('data.sqlite', false).icon).toBe(Database);
    expect(getFileIcon('server.pem', false).icon).toBe(FileKey2);
  });

  it('区分字体、演示文稿和安装包', () => {
    expect(getFileIcon('Inter.woff2', false).icon).toBe(FileType2);
    expect(getFileIcon('review.pptx', false).icon).toBe(Presentation);
    expect(getFileIcon('client.msi', false).icon).toBe(PackageOpen);
  });

  it('为常见编程语言使用可辨识的图标与颜色', () => {
    expect(getFileIcon('worker.py', false).icon).toBe(FlaskConical);
    expect(getFileIcon('app.ts', false).icon).toBe(Braces);
    expect(getFileIcon('view.tsx', false).icon).toBe(Atom);
    expect(getFileIcon('main.rs', false).icon).toBe(Blocks);
  });

  it('将 Docker 配置与普通 YAML 明确区分', () => {
    expect(getFileIcon('docker-compose.yml', false).icon).toBe(Container);
    expect(getFileIcon('docker-compose.yml', false).icon).not.toBe(
      getFileIcon('deployment.yml', false).icon,
    );
  });
});
