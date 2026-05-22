import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { BadgeVariant } from '@/lib/utils';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-brand-50 text-brand-800 ring-brand-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  info:    'bg-sky-50 text-sky-800 ring-sky-600/20',
  danger:  'bg-red-50 text-red-800 ring-red-600/20',
  neutral: 'bg-stone-100 text-stone-700 ring-stone-600/20',
};

export function Badge({
  variant = 'neutral',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium ring-1 ring-inset',
      variants[variant], className
    )}>
      {children}
    </span>
  );
}
