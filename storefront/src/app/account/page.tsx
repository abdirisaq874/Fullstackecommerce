'use client';

import Link from 'next/link';
import { Package, MapPin, RefreshCcw, MessageSquare, ChevronRight } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { useAppSelector } from '@/store';
import { useListOrdersQuery } from '@/store/api/ordersApi';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';

const QUICK = [
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/returns', label: 'Returns', icon: RefreshCcw },
  { href: '/account/messages', label: 'Messages', icon: MessageSquare },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
];

export default function AccountOverview() {
  const user = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useListOrdersQuery({ limit: 3 });
  const orders = data?.data ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <p className="text-sm font-semibold text-muted-fg">Account</p>
        <p className="mt-1 font-display text-xl font-bold">{user?.firstName} {user?.lastName}</p>
        <p className="text-muted-fg">{user?.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link key={q.href} href={q.href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-5 text-center shadow-card transition hover:-translate-y-1 hover:shadow-lift">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand"><Icon className="h-5 w-5" /></span>
              <span className="text-sm font-bold">{q.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recent orders</h2>
          <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">View all <ChevronRight className="h-4 w-4" /></Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14" />)}</div>
        ) : orders.length === 0 ? (
          <p className="py-6 text-center text-muted-fg">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o._id}>
                <Link href={`/account/orders/${o._id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand">
                  <div>
                    <p className="font-bold">{o.orderNumber}</p>
                    <p className="text-sm text-muted-fg">{formatDate(o.createdAt || o.placedAt)} · {o.items.length} item(s)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={o.status} />
                    <span className="font-bold">{formatPrice(o.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
