import { X, Download, Loader2 } from 'lucide-react';
import { useBrowserStore } from '../../stores/browserStore';

/** 下载进度条组件。 */
export function DownloadBar() {
  const { isDownloading, downloadProgress, downloadStatusText } = useBrowserStore();

  if (!isDownloading && !downloadStatusText) return null;
  if (!downloadStatusText) return null;

  const isDone = !isDownloading && downloadProgress >= 100;

  return (
    <div className="fixed right-4 bottom-4 z-40 w-80 rounded-lg border bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <Download className="h-4 w-4 text-green-500" />
          )}
          <span>{isDone ? '下载完成' : '下载中'}</span>
        </div>
        {!isDownloading && (
          <button
            className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => useBrowserStore.setState({ downloadStatusText: '' })}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${downloadProgress}%` }}
        />
      </div>
      <div className="mt-1.5 truncate text-xs text-gray-500">{downloadStatusText}</div>
    </div>
  );
}
