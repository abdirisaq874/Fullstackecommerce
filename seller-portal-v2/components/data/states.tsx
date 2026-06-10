import { Inbox, AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/primitives/button';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: typeof Inbox;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-forest-900 grid place-items-center mx-auto mb-4">
        <Icon className="w-5 h-5 text-stone-500 dark:text-stone-400" strokeWidth={2} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">{title}</h3>
      {description && <p className="text-sm text-stone-600 dark:text-stone-300 mb-4 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="px-5 py-16 text-center" role="alert">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 grid place-items-center mx-auto mb-4">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">Something went wrong</h3>
      <p className="text-sm text-stone-600 dark:text-stone-300 mb-4 max-w-sm mx-auto">{message ?? 'We couldn’t load this data. Please try again.'}</p>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-stone-100">
      <div className="bg-stone-50/60 border-b border-stone-200 px-5 py-2.5 flex gap-6">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 bg-stone-200 rounded animate-pulse-soft" style={{ width: `${60 + i * 20}px` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex gap-6 items-center">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-3 bg-stone-100 rounded animate-pulse-soft" style={{ width: `${80 + ((i + j) % 4) * 30}px`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 100 }: { height?: number }) {
  return <div className="bg-stone-100 rounded-lg animate-pulse-soft" style={{ height }} />;
}
