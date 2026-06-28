import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'focus-ring h-11 w-full rounded-xl border-2 border-line bg-surface px-4 text-ink placeholder:text-muted-fg transition-colors hover:border-ink/20 focus:border-brand',
              leftIcon && 'pl-10',
              error && 'border-danger focus:border-danger',
              className,
            )}
            aria-invalid={!!error}
            {...props}
          />
        </div>
        {error ? (
          <p className="mt-1 text-sm font-medium text-danger">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-sm text-muted-fg">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
