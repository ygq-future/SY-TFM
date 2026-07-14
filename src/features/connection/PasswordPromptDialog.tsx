import { useState } from 'react';
import { KeyRound, X } from 'lucide-react';

/** 密码提示对话框（连接时密码为空则弹出）。 */
export function PasswordPromptDialog({
  hostName,
  onConfirm,
  onCancel,
}: {
  hostName: string;
  onConfirm: (password: string, remember: boolean) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onConfirm(password, remember);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-blue-500" />
            输入密码
          </h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          连接 <span className="font-medium">{hostName}</span> 需要密码
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            type="password"
            className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            记住密码（加密存储）
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border px-4 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
              disabled={!password}
            >
              连接
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
