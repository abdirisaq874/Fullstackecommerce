'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, ChevronRight } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import { Button, EmptyState } from '@/components/ui';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import { useListOrdersQuery } from '@/store/api/ordersApi';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListOrdersQuery({ page, limit: 10 });
  const orders = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-12 w-12" />}
        title="No orders yet"
        description="When you place an order it’ll show up here."
        action={<Link href="/search"><Button>Start shopping</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Your orders</h2>
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o._id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <Link href={`/account/orders/${o._id}`} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-display text-lg font-bold">{o.orderNumber}</p>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="text-sm text-muted-fg">{formatDate(o.createdAt || o.placedAt)} · {o.items.length} item(s)</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-display text-lg font-extrabold">{formatPrice(o.total)}</span>
                <ChevronRight className="h-5 w-5 text-muted-fg" />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="text-sm font-semibold">Page {meta.page} of {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
