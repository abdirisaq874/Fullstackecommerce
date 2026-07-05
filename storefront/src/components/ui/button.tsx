import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'sale';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/90 active:scale-[0.98]',
  accent: 'bg-brand text-white hover:bg-brand-700 active:scale-[0.98]',
  secondary: 'bg-muted text-ink hover:bg-line active:scale-[0.98]',
  outline: 'border border-line bg-surface text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-muted',
  sale: 'bg-sale text-white font-bold hover:brightness-105 active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-sm',
  lg: 'h-13 px-8 text-base h-[3.25rem]',
  icon: 'h-11 w-11',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
