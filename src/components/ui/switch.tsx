/** Switch — accessible toggle built on a native checkbox (role="switch"). */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => (
  <label className={cn('relative inline-flex cursor-pointer items-center', props.disabled && 'cursor-not-allowed opacity-50')}>
    <input ref={ref} type="checkbox" role="switch" className="peer sr-only" {...props} />
    <span
      aria-hidden
      className={cn(
        'h-5 w-9 rounded-full bg-input transition-colors peer-checked:bg-primary',
        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
        'after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-background after:shadow after:transition-transform',
        'peer-checked:after:translate-x-4',
        className,
      )}
    />
  </label>
));
Switch.displayName = 'Switch';
