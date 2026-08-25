import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { AppWindow } from '../../types/enums/AppWindow';

const editorWindowMode: AppWindow = 'editor';

function windowErrorMessage(payload: unknown): string {
  if (payload instanceof Error) return payload.message;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(payload);
}

/** 判断当前 Tauri webview 是否为独立在线编辑器窗口。 */
export function isEditorWindow(): boolean {
  return new URLSearchParams(window.location.search).get('window') === editorWindowMode;
}

/** 创建一个独立的在线编辑器窗口；每次调用都允许打开同一文件的新实例。 */
export async function openEditorWindow(
  hostId: string,
  remotePath: string,
  fileName: string,
): Promise<void> {
  const label = `editor-${crypto.randomUUID()}`;
  const query = new URLSearchParams({
    window: editorWindowMode,
    hostId,
    remotePath,
    fileName,
  });
  const editorWindow = new WebviewWindow(label, {
    url: `index.html?${query.toString()}`,
    title: `${fileName} — SY-TFM`,
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    center: true,
    decorations: false,
    transparent: true,
    shadow: true,
    backgroundColor: [0, 0, 0, 0],
    resizable: true,
    focus: true,
    visible: true,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    void editorWindow.once<null>('tauri://created', () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    void editorWindow.once<unknown>('tauri://error', (event) => {
      if (settled) return;
      settled = true;
      reject(new Error(windowErrorMessage(event.payload)));
    });
  });
}
