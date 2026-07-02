import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — the classic shadcn/ui helper: merges conditional class names and
 * resolves Tailwind conflicts (`p-2` + `p-4` → `p-4`), so component variants
 * can be safely overridden from call sites.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
