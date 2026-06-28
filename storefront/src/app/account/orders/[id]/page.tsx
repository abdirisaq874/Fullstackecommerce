'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, RefreshCcw, RotateCcw, ArrowLeft, ShoppingBag } from 'lucide-react';
import { cn, formatPrice, formatDate } from '@/lib/utils';
import { Button, EmptyState } from '@/components/ui';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';
import { useGetOrderQuery, useCancelOrderMutation } from '@/store/api/ordersApi';
import { useCreateReturnMutation } from '@/store/api/returnsApi';
import { useAddToCartMutation } from '@/store/api/cartApi';
import { useAppDispatch } from '@/store';
import { openCart } from '@/store/slices/uiSlice';
import type { Order } from '@/types';

const TIMELINE: { key: keyof Order; label: string }[] = [
  { key: 'placedAt', label: 'Placed' },
  { key: 'confirmedAt', label: 'Confirmed' },
  { key: 'shippedAt', label: 'Shipped' },
  { key: 'deliveredAt', label: 'Delivered' },
];

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: order, isLoading, isError } = useGetOrderQuery(params.id);
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [createReturn, { isLoading: returning }] = useCreateReturnMutation();
  const [addToCart] = useAddToCartMutation();
  const [returnModal, setReturnModal] = useState(false);

  if (isLoading) return <div className="skeleton h-96" />;
  if (isError || !order)
    return <EmptyState title="Order not found" action={<Link href="/account/orders"><Button>Back to orders</Button></Link>} />;

  const cancellable = ['pending', 'confirmed', 'processing'].includes(order.status);
  const returnable = ['shipped', 'delivered'].includes(order.status);

  const reorder = async () => {
    try {
      await Promise.all(order.items.map((it) => addToCart({ productId: it.productId, variantSku: it.variantSku, quantity: it.quantity }).unwrap()));
      toast.success('Items added to cart');
      dispatch(openCart());
    } catch {
      toast.error('Some items could not be re-added');
    }
  };

  const cancel = async () => {
    try { await cancelOrder({ id: order._id }).unwrap(); toast.success('Order cancelled'); }
    catch { toast.error('Could not cancel order'); }
  };

  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-fg hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{order.orderNumber}</h2>
          <p className="text-sm text-muted-fg">Placed {formatDate(order.placedAt || order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Timeline */}
      {order.status !== 'cancelled' ? (
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <ol className="flex items-center justify-between">
            {TIMELINE.map((step, i) => {
              const reached = !!order[step.key];
              return (
                <li key={step.key} className="flex flex-1 flex-col items-center text-center">
                  <span className={cn('grid h-9 w-9 place-items-center rounded-full', reached ? 'bg-brand-gradient text-white' : 'bg-muted text-muted-fg')}>
                    {reached ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={cn('mt-2 text-xs font-bold', reached ? 'text-ink' : 'text-muted-fg')}>{step.label}</span>
                  {reached && <span className="text-[11px] text-muted-fg">{formatDate(order[step.key] as string)}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-danger/30 bg-danger/5 p-4 text-sm font-semibold text-danger">
          This order was cancelled{order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ''}.
        </div>
      )}

      {/* Items */}
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h3 className="mb-4 font-bold">Items</h3>
        <ul className="divide-y divide-line">
          {order.items.map((it) => (
            <li key={it.variantSku} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>{it.productName} <span className="text-muted-fg">× {it.quantity}</span></span>
              <span className="font-semibold">{formatPrice(it.totalPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <Row label="Subtotal" value={formatPrice(order.subtotal)} />
          {order.discountAmount > 0 && <Row label="Discount" value={`−${formatPrice(order.discountAmount)}`} />}
          <Row label="Shipping" value={order.shippingCost ? formatPrice(order.shippingCost) : 'Free'} />
          <Row label="Tax" value={formatPrice(order.taxAmount)} />
          <div className="flex justify-between pt-2 text-base font-extrabold"><span>Total</span><span>{formatPrice(order.total)}</span></div>
        </div>
      </div>

      {/* Addresses */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AddressCard title="Shipping address" a={order.shippingAddress} />
        {order.billingAddress && <AddressCard title="Billing address" a={order.billingAddress} />}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={reorder} className="gap-2"><ShoppingBag className="h-4 w-4" /> Reorder</Button>
        {returnable && <Button variant="outline" onClick={() => setReturnModal(true)} className="gap-2"><RefreshCcw className="h-4 w-4" /> Request return</Button>}
        {cancellable && <Button variant="ghost" loading={cancelling} onClick={cancel} className="gap-2 text-danger"><X className="h-4 w-4" /> Cancel order</Button>}
      </div>

      {returnModal && (
        <ReturnModal
          order={order}
          loading={returning}
          onClose={() => setReturnModal(false)}
          onSubmit={async (items) => {
            try {
              await createReturn({ orderId: order._id, items }).unwrap();
              toast.success('Return requested');
              setReturnModal(false);
              router.push('/account/returns');
            } catch { toast.error('Could not submit return'); }
          }}
        />
      )}
    </div>
  );
}

function ReturnModal({ order, onClose, onSubmit, loading }: {
  order: Order;
  onClose: () => void;
  onSubmit: (items: { sku: string; qty: number; reason: string }[]) => void;
  loading: boolean;
}) {
  const [sel, setSel] = useState<Record<string, { qty: number; reason: string }>>({});
  const toggle = (sku: string, max: number) =>
    setSel((s) => (s[sku] ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== sku)) : { ...s, [sku]: { qty: max, reason: '' } }));

  const items = Object.entries(sel).map(([sku, v]) => ({ sku, qty: v.qty, reason: v.reason || 'No longer needed' }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-surface p-6 shadow-lift">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">Request a return</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <ul className="space-y-3">
          {order.items.map((it) => {
            const on = !!sel[it.variantSku];
            return (
              <li key={it.variantSku} className={cn('rounded-xl border-2 p-3', on ? 'border-brand bg-brand-50' : 'border-line')}>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={on} onChange={() => toggle(it.variantSku, it.quantity)} className="h-4 w-4 accent-[hsl(var(--brand))]" />
                  <span className="flex-1 text-sm font-semibold">{it.productName} <span className="text-muted-fg">× {it.quantity}</span></span>
                </label>
                {on && (
                  <input
                    placeholder="Reason (e.g. wrong size)"
                    value={sel[it.variantSku].reason}
                    onChange={(e) => setSel((s) => ({ ...s, [it.variantSku]: { ...s[it.variantSku], reason: e.target.value } }))}
                    className="focus-ring mt-2 h-10 w-full rounded-lg border-2 border-line px-3 text-sm focus:border-brand"
                  />
                )}
              </li>
            );
          })}
        </ul>
        <Button className="mt-5 w-full gap-2" loading={loading} disabled={items.length === 0} onClick={() => onSubmit(items)}>
          <RotateCcw className="h-4 w-4" /> Submit return request
        </Button>
      </div>
    </div>
  );
}

function AddressCard({ title, a }: { title: string; a: Order['shippingAddress'] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card text-sm">
      <p className="mb-1 font-bold">{title}</p>
      <p className="text-muted-fg">{a.fullName}</p>
      <p className="text-muted-fg">{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
      <p className="text-muted-fg">{a.city} {a.state} {a.postalCode}, {a.countryCode}</p>
      {a.phone && <p className="text-muted-fg">{a.phone}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-fg">{label}</span><span className="font-semibold">{value}</span></div>;
}
