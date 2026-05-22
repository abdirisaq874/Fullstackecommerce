import clsx from 'clsx';
import { Check } from 'lucide-react';
import { ORDER_FLOW, cap } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types';

export function OrderStatusFlow({ status }: { status: OrderStatus }) {
  const currentIdx = ORDER_FLOW.indexOf(status as any);
  const isTerminal = status === 'cancelled' || status === 'refunded';

  if (isTerminal) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-900">
        Order {status}.
      </div>
    );
  }

  return (
    <ol className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
      {ORDER_FLOW.map((s, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <li key={s} className="flex items-center gap-1 shrink-0">
            <div className={clsx(
              'flex items-center gap-2 px-2.5 py-1 rounded text-xs whitespace-nowrap',
              isCurrent ? 'bg-brand-100 text-brand-800 font-medium' :
              isDone    ? 'bg-stone-100 text-stone-600' :
                          'bg-stone-50 text-stone-400'
            )}>
              {isDone
                ? <Check className="w-3 h-3" strokeWidth={3} />
                : <span className={clsx('w-1.5 h-1.5 rounded-full', isCurrent ? 'bg-brand-600' : 'bg-stone-300')} />
              }
              {cap(s)}
            </div>
            {i < ORDER_FLOW.length - 1 && <div className={clsx('w-3 h-px', isDone ? 'bg-stone-300' : 'bg-stone-200')} />}
          </li>
        );
      })}
    </ol>
  );
}
