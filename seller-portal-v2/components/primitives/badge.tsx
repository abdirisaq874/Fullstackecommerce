import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { BadgeVariant } from '@/lib/utils';

const variants: Record<BadgeVariant, string> = {
  success: 'bg-brand-50 text-brand-800 ring-brand-600/20 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-400/30',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-400/30',
  info:    'bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-900/40 dark:text-sky-200 dark:ring-sky-400/30',
  danger:  'bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-400/30',
  neutral: 'bg-stone-100 text-stone-700 ring-stone-600/20 dark:bg-forest-900 dark:text-stone-200 dark:ring-stone-400/20',
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
