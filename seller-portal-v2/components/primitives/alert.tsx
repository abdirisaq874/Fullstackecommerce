import clsx from 'clsx';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type Variant = 'info' | 'warning' | 'success' | 'danger';

const styles: Record<Variant, { wrap: string; Icon: typeof Info }> = {
  info:    { wrap: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-100',                Icon: Info },
  warning: { wrap: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100',    Icon: AlertTriangle },
  success: { wrap: 'bg-brand-50 border-brand-200 text-brand-900 dark:bg-brand-950/40 dark:border-brand-900 dark:text-brand-100',    Icon: CheckCircle2 },
  danger:  { wrap: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-100',                Icon: XCircle },
};

export function Alert({ variant = 'info', children, className }: { variant?: Variant; children: ReactNode; className?: string }) {
  const { wrap, Icon } = styles[variant];
  return (
    <div className={clsx('flex items-start gap-3 px-4 py-3 rounded-md border text-sm', wrap, className)}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
