import { cn } from '../../lib/utils';

/** 主题化公共开关，选中态统一使用全局强调色。 */
export function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      className={cn('glass-switch', checked && 'glass-switch--checked', className)}
      onClick={() => onCheckedChange(!checked)}
    >
      <span />
    </button>
  );
}
