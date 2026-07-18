import { open, save } from '@tauri-apps/plugin-dialog';

/** 打开系统原生目录选择器，并将取消统一为 null。 */
export async function pickDirectory(title: string, defaultPath?: string): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
    defaultPath: defaultPath || undefined,
  });
  return typeof selected === 'string' ? selected : null;
}

/** 打开系统原生文件选择器。 */
export async function pickFile(title: string): Promise<string | null> {
  const selected = await open({ directory: false, multiple: false, title });
  return typeof selected === 'string' ? selected : null;
}

/** 打开系统原生图片选择器并返回真实文件路径。 */
export async function pickImageFile(
  title: string,
  filterName: string,
  defaultPath?: string,
): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title,
    defaultPath: defaultPath || undefined,
    filters: [
      {
        name: filterName,
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'],
      },
    ],
  });
  return typeof selected === 'string' ? selected : null;
}

/** 打开系统原生保存文件选择器。 */
export async function pickSaveFile(
  title: string,
  defaultPath: string,
  filterName: string,
): Promise<string | null> {
  return save({
    title,
    defaultPath,
    filters: [{ name: filterName, extensions: ['sytfm'] }],
  });
}
