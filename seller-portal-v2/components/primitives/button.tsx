import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:        'bg-brand-700 text-white hover:bg-brand-800 focus-visible:ring-brand-500',
  secondary:      'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300 focus-visible:ring-stone-400',
  ghost:          'text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-stone-400',
  danger:         'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  'danger-ghost': 'text-red-600 hover:bg-red-50',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-sm gap-1.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
      {...rest}
    />
  )
);
Button.displayName = 'Button';
