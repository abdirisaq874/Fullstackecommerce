'use client';

import Link from 'next/link';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Button, Container, Badge } from '@/components/ui';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useGetOrderQuery } from '@/store/api/ordersApi';

export default function ConfirmationPage({ params }: { params: { orderId: string } }) {
  return (
    <RequireAuth>
      <Confirmation orderId={params.orderId} />
    </RequireAuth>
  );
}

function Confirmation({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError } = useGetOrderQuery(orderId);

  if (isLoading) return <Container className="py-20"><div className="skeleton mx-auto h-72 max-w-2xl" /></Container>;
  if (isError || !order)
    return (
      <Container className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Order not found</h1>
        <Link href="/account/orders" className="mt-4 inline-block"><Button>View your orders</Button></Link>
      </Container>
    );

  return (
    <Container className="py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-brand-gradient p-8 text-center text-white shadow-pop">
          <CheckCircle2 className="mx-auto h-16 w-16" />
          <h1 className="mt-4 font-display text-3xl font-extrabold">Thank you for your order!</h1>
          <p className="mt-2 text-white/90">Order <strong>{order.orderNumber}</strong> is confirmed. A receipt is on its way to your email.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Order details</h2>
            <Badge variant="brand" className="capitalize">{order.status}</Badge>
          </div>
          <ul className="divide-y divide-line">
            {order.items.map((it) => (
              <li key={it.variantSku} className="flex justify-between gap-3 py-3 text-sm">
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

          <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-semibold">Shipping to</p>
            <p className="text-muted-fg">{order.shippingAddress.fullName}, {order.shippingAddress.line1}, {order.shippingAddress.city} {order.shippingAddress.postalCode}, {order.shippingAddress.countryCode}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={`/account/orders/${order._id}`} className="flex-1"><Button variant="outline" className="w-full gap-2"><Package className="h-4 w-4" /> Track order</Button></Link>
          <Link href="/search" className="flex-1"><Button className="w-full gap-2">Continue shopping <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </div>
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-fg">{label}</span><span className="font-semibold">{value}</span></div>;
}
