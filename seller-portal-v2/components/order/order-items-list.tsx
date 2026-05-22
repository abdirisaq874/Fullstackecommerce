import { Money } from '@/components/shared/format';
import type { OrderItem } from '@/lib/types';

export function OrderItemsList({ items, currency = 'USD' }: { items: OrderItem[]; currency?: string }) {
  return (
    <div className="divide-y divide-stone-100">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 px-5 py-3">
          <div className="w-12 h-12 rounded-md bg-stone-100 grid place-items-center shrink-0 ring-1 ring-stone-200">
            <span className="font-serif text-base text-stone-500">{item.initial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-stone-900 truncate">{item.name}</div>
            <div className="text-xs text-stone-500 font-mono mt-0.5">{item.sku}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm text-stone-700 tabular-nums">× {item.quantity}</div>
            <div className="text-sm text-stone-900 font-medium tabular-nums">
              <Money value={item.price * item.quantity} currency={currency} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
