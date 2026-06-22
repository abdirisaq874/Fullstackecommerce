'use client';

/**
 * /customers/[userId] — single-customer detail (seller-scoped).
 *
 * Data: `GET /seller/customers/:userId` (see `lib/api/customers-api.ts`).
 * Returns the customer summary + the orders they placed that include items
 * from this seller. Order items belonging to other sellers are stripped
 * server-side.
 *
 * Each order row links to `/orders/[orderId]` so fulfilment can happen from
 * the existing orders detail page.
 */

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Package,
  ShoppingBag,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import {
  useGetCustomerQuery,
  type SellerCustomerOrder,
} from '@/lib/api';
import { statusVariant } from '@/lib/utils';

function formatMoney(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (absSec < 60) return rtf.format(diffSec, 'second');
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (absSec < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (absSec < 604_800) return rtf.format(Math.round(diffSec / 86_400), 'day');
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function orderTotal(order: SellerCustomerOrder): number {
  return order.sellerSubtotal;
}

export default function CustomerDetailPage({ params }: { params: { userId: string } }) {
  const router = useRouter();
  const { data: customer, isLoading, isError, refetch } = useGetCustomerQuery(params.userId);

  if (isError) {
    return (
      <>
        <button
          onClick={() => router.push('/customers')}
          className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3 h-3" /> Back to customers
        </button>
        <Card>
          <ErrorState onRetry={refetch} />
        </Card>
      </>
    );
  }

  if (isLoading || !customer) {
    return (
      <>
        <button
          onClick={() => router.push('/customers')}
          className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3 h-3" /> Back to customers
        </button>
        <CardSkeleton height={180} />
        <div className="h-4" />
        <CardSkeleton height={300} />
      </>
    );
  }

  const fullName =
    customer.fullName?.trim() ||
    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
    'Customer';

  return (
    <>
      <button
        onClick={() => router.push('/customers')}
        className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Back to customers
      </button>

      <PageHeader
        title={fullName}
        subtitle={
          <span className="flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> {customer.email || '—'}
          </span>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1 flex items-center gap-1.5">
            <ShoppingBag className="w-3 h-3" /> Total orders
          </div>
          <div className="text-2xl font-serif text-stone-900 tabular-nums">
            {customer.orderCount.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">
            Lifetime value
          </div>
          <div className="text-2xl font-serif text-stone-900 tabular-nums">
            {formatMoney(customer.lifetimeValue)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Last order
          </div>
          <div className="text-sm text-stone-900">{formatRelativeTime(customer.lastOrderAt)}</div>
          <div className="text-xs text-stone-500 mt-0.5">{formatDate(customer.lastOrderAt)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">First order</div>
          <div className="text-sm text-stone-900">{formatRelativeTime(customer.firstOrderAt)}</div>
          <div className="text-xs text-stone-500 mt-0.5">{formatDate(customer.firstOrderAt)}</div>
        </Card>
      </div>

      {/* Orders list */}
      <Card>
        <CardHeader>
          <CardTitle>
            Orders ({customer.orders.length}){' '}
            <span className="text-xs text-stone-500 font-normal ml-1">
              · scoped to your items
            </span>
          </CardTitle>
        </CardHeader>

        {customer.orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No matching orders"
            description="This customer has no orders that include items from your store."
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {customer.orders.map((order) => (
              <li key={order.orderId}>
                <button
                  onClick={() => router.push(`/orders/${order.orderId}`)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-stone-50/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-medium text-stone-900">
                        {order.orderNumber || order.orderId}
                      </span>
                      <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                      <span className="text-xs text-stone-500">
                        · {order.sellerItemCount} item{order.sellerItemCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(order.placedAt ?? order.createdAt)}
                      <span className="text-stone-300">·</span>
                      {formatRelativeTime(order.placedAt ?? order.createdAt)}
                    </div>
                    {order.items.length > 0 && (
                      <div className="text-xs text-stone-500 mt-1 truncate">
                        {order.items
                          .slice(0, 3)
                          .map((i) => `${i.productName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
                          .join(' · ')}
                        {order.items.length > 3 && ` · +${order.items.length - 3} more`}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-stone-900 tabular-nums">
                      {formatMoney(orderTotal(order), order.currency || 'USD')}
                    </div>
                    <div className="text-xs text-stone-500">your subtotal</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
