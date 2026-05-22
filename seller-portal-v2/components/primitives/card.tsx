import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('bg-white border border-stone-200 rounded-lg', className)}>{children}</div>;
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-3 flex-wrap', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx('text-sm font-medium text-stone-900', className)}>{children}</h2>;
}
