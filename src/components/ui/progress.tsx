/** Progress — simple determinate bar (password strength meter, etc.). */

import { type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** 0..100 */
  value: number;
  /** Tailwind class for the filled part — lets callers color by meaning. */
  indicatorClassName?: string;
}

export function Progress({ value, className, indicatorClassName, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-all duration-300', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
