import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 className（clsx + tailwind-merge），供 shadcn/ui 组件使用。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
