'use client';

import Link from 'next/link';
import { RefreshCcw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge, Button, EmptyState } from '@/components/ui';
import { useListReturnsQuery } from '@/store/api/returnsApi';

const STATUS_VARIANT: Record<string, 'brand' | 'sale' | 'success' | 'neutral'> = {
  requested: 'sale',
  approved: 'brand',
  received: 'brand',
  refunded: 'success',
  rejected: 'neutral',
};

export default function ReturnsPage() {
  const { data, isLoading } = useListReturnsQuery({});
  const returns = data?.data ?? [];

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)}</div>;

  if (returns.length === 0) {
    return (
      <EmptyState
        icon={<RefreshCcw className="h-12 w-12" />}
        title="No returns yet"
        description="You can request a return from any delivered order."
        action={<Link href="/account/orders"><Button>View orders</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Returns</h2>
      <ul className="space-y-3">
        {returns.map((r) => (
          <li key={r._id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Return #{r._id.slice(-6).toUpperCase()}</p>
                <p className="text-sm text-muted-fg">Requested {formatDate(r.createdAt)} · {r.items?.length ?? 0} item(s)</p>
              </div>
              <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'} className="capitalize">{r.status}</Badge>
            </div>
            {r.items?.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted-fg">
                {r.items.map((it, i) => <li key={i}>{it.qty} × {it.sku} — {it.reason}</li>)}
              </ul>
            )}
            <Link href={`/account/orders/${r.orderId}`} className="mt-3 inline-block text-sm font-bold text-brand hover:underline">View order</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
