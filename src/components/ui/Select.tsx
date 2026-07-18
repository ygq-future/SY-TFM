import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Glassmorphism 公共下拉选择器。 */
export function Select<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  id,
  icon,
  className,
}: {
  value: T;
  options: SelectOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  id?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  return (
    <div ref={rootRef} className={cn('select-root', isOpen && 'select-root--open', className)}>
      <button
        id={id}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        {icon && <span className="select-leading-icon">{icon}</span>}
        <span className="select-value">
          <strong>{selected?.label}</strong>
          {selected?.description && <small>{selected.description}</small>}
        </span>
        <ChevronDown className="select-chevron" />
      </button>
      <div className="select-popover" role="listbox" aria-label={ariaLabel} hidden={!isOpen}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={isSelected ? 'select-option select-option--selected' : 'select-option'}
              onClick={() => {
                onValueChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {isSelected && <Check />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
