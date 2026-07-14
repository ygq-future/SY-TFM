import { ChevronRight, Home } from 'lucide-react';

/** 面包屑路径栏。 */
export function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  const segments = path.split('/').filter(Boolean);
  const paths: { label: string; path: string }[] = [
    { label: '/', path: '/' },
    ...segments.map((seg, i) => ({
      label: seg,
      path: '/' + segments.slice(0, i + 1).join('/'),
    })),
  ];

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b px-4 py-2 text-sm">
      {paths.map((item, i) => (
        <div key={item.path} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />}
          <button
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={() => onNavigate(item.path)}
          >
            {i === 0 && <Home className="h-3.5 w-3.5" />}
            <span className="truncate">{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
