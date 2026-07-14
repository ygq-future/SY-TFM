import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { RemoteHost } from '../../types/generated/RemoteHost';
import type { Protocol } from '../../types/enums/Protocol';
import { useConnectionStore } from '../../stores/connectionStore';

/** 新建/编辑主机对话框。 */
export function HostEditDialog({
  host,
  onClose,
}: {
  host: RemoteHost | null;
  onClose: () => void;
}) {
  const { addHost, updateHost } = useConnectionStore();
  const isEdit = host !== null;

  const [form, setForm] = useState<RemoteHost>(
    host ?? {
      id: '',
      name: '',
      protocol: 'sftp',
      host: '',
      port: 0,
      username: 'anonymous',
      password: '',
      tags: '',
      downloadPath: null,
      https: true,
      basePath: null,
      isConnected: false,
    },
  );

  useEffect(() => {
    if (!isEdit) {
      // 新建时设置默认端口
      setForm((f) => ({ ...f, port: defaultPortFor(f.protocol) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.protocol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && host) {
      await updateHost(form);
    } else {
      await addHost({ ...form, id: crypto.randomUUID() });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? '编辑主机' : '新建主机'}</h3>
          <button
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="名称">
            <input
              className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="协议">
            <select
              className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              value={form.protocol}
              onChange={(e) => setForm({ ...form, protocol: e.target.value as Protocol })}
            >
              <option value="sftp">SFTP</option>
              <option value="webDav">WebDAV</option>
            </select>
          </Field>
          <div className="flex gap-3">
            <Field label="主机" className="flex-1">
              <input
                className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                placeholder="example.com"
                required
              />
            </Field>
            <Field label="端口" className="w-24">
              <input
                type="number"
                className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                required
              />
            </Field>
          </div>
          <Field label="用户名">
            <input
              className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </Field>
          <Field label="密码（留空则连接时输入）">
            <input
              type="password"
              className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Field label="标签（逗号分隔，如 prod,web）">
            <input
              className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </Field>
          {form.protocol === 'webDav' && (
            <>
              <Field label="基础路径前缀（如 /remote.php/dav/files/user）">
                <input
                  className="w-full rounded border px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                  value={form.basePath ?? ''}
                  onChange={(e) => setForm({ ...form, basePath: e.target.value || null })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.https}
                  onChange={(e) => setForm({ ...form, https: e.target.checked })}
                />
                使用 HTTPS
              </label>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border px-4 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              {isEdit ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

/** 根据协议返回默认端口。 */
function defaultPortFor(protocol: Protocol): number {
  switch (protocol) {
    case 'sftp':
      return 22;
    case 'webDav':
      return 443;
    case 'ftp':
      return 21;
    case 's3':
      return 443;
    case 'scp':
      return 22;
    default:
      return 0;
  }
}
