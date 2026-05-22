'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, CreditCard, Truck, Mail, Clock, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Alert } from '@/components/primitives/alert';
import { OrderStatusFlow } from '@/components/order/order-status-flow';
import { OrderItemsList } from '@/components/order/order-items-list';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { Money, CountryFlag } from '@/components/shared/format';
import { useGetOrderQuery, useSetOrderStatusMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { nextOrderStatus, statusVariant, cap } from '@/lib/utils';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: order, isLoading, isError, refetch } = useGetOrderQuery(params.id);
  const [setStatus, { isLoading: updating }] = useSetOrderStatusMutation();
  const toast = useToast();

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !order) return <CardSkeleton height={400} />;

  const next = nextOrderStatus(order.status);
  const canFulfill = ['confirmed', 'processing', 'picked', 'packed'].includes(order.status);

  return (
    <>
      <button onClick={() => router.push('/orders')} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to orders
      </button>

      <PageHeader
        title={`Order ${order.id}`}
        subtitle={<span className="flex items-center gap-2"><Badge variant={statusVariant(order.status)}>{order.status}</Badge> · Placed {order.date}</span>}
        actions={
          <>
            <Button onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print</Button>
            {next && (
              <Button
                onClick={async () => { await setStatus({ id: order.id, status: next as any }); toast.success(`Marked as ${cap(next)}`); }}
                disabled={updating}
              >
                Mark as {cap(next)}
              </Button>
            )}
            {canFulfill && (
              <Link href={`/orders/${order.id}/fulfill`}>
                <Button variant="primary"><Truck className="w-3.5 h-3.5" /> Fulfill order</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6">
        <OrderStatusFlow status={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{order.itemsList.length} item{order.itemsList.length === 1 ? '' : 's'}</CardTitle>
            </CardHeader>
            <OrderItemsList items={order.itemsList} />
            <div className="border-t border-stone-200 px-5 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="tabular-nums"><Money value={order.subtotal} /></span></div>
              <div className="flex justify-between"><span className="text-stone-500">Shipping</span><span className="tabular-nums"><Money value={order.shipping} /></span></div>
              {order.tax > 0 && <div className="flex justify-between"><span className="text-stone-500">Tax</span><span className="tabular-nums"><Money value={order.tax} /></span></div>}
              <div className="flex justify-between pt-2 border-t border-stone-100 font-medium">
                <span>Total</span><span className="tabular-nums font-serif text-lg"><Money value={order.total} /></span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <ol className="px-5 py-4 space-y-3">
              {order.timeline.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-stone-900">{e.event}</div>
                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> {e.date}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-medium">Customer</h3>
            <div className="text-sm text-stone-900 font-medium">{order.customer}</div>
            <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {order.customerEmail}</div>
            <div className="text-xs text-stone-500 mt-0.5">{order.customerPhone}</div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-medium flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Shipping
            </h3>
            <div className="text-sm text-stone-900 flex items-center gap-1.5">
              <CountryFlag destination={order.destination} /> {order.destinationFull}
            </div>
            <div className="text-xs text-stone-500 mt-2">Carrier · {order.carrier}</div>
            {order.trackingNumber && (
              <div className="text-xs text-stone-500 mt-0.5">Tracking · <span className="font-mono text-stone-700">{order.trackingNumber}</span></div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-medium flex items-center gap-1.5">
              <CreditCard className="w-3 h-3" /> Payment
            </h3>
            <div className="text-sm text-stone-900">{order.paymentMethod}</div>
            <div className="text-xs text-stone-500 mt-1">Paid · <span className="tabular-nums"><Money value={order.total} /></span></div>
          </Card>
        </div>
      </div>
    </>
  );
}
