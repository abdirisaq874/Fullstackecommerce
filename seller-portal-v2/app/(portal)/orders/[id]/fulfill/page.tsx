'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Printer, Package, Truck, Hash, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Alert } from '@/components/primitives/alert';
import { Field, Input, Select } from '@/components/primitives/field';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { Money, CountryFlag } from '@/components/shared/format';
import { useGetOrderQuery, useFulfillOrderMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import clsx from 'clsx';

const STEPS = [
  { id: 'pack', label: 'Pack',    description: 'Confirm items and print docs', Icon: Package },
  { id: 'pick', label: 'Pick',    description: 'Tick off each item as picked', Icon: Check },
  { id: 'ship', label: 'Ship',    description: 'Assign carrier and tracking',  Icon: Truck },
  { id: 'done', label: 'Done',    description: 'Shipped — customer notified',  Icon: CheckCircle2 },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function FulfillOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: order, isLoading, isError, refetch } = useGetOrderQuery(params.id);
  const [fulfill, { isLoading: shipping }] = useFulfillOrderMutation();
  const toast = useToast();

  const [step, setStep] = useState<StepId>('pack');
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [carrier, setCarrier] = useState('DHL Express');
  const [tracking, setTracking] = useState('');
  const [weight, setWeight] = useState('');

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !order) return <CardSkeleton height={400} />;

  const allPicked = order.itemsList.every(i => pickedItems.has(i.sku));
  const stepIdx = STEPS.findIndex(s => s.id === step);

  const doFulfill = async () => {
    if (!tracking.trim()) {
      toast.error('Tracking number is required');
      return;
    }
    await fulfill({ id: order.id, carrier, trackingNumber: tracking, weightKg: weight ? Number(weight) : undefined }).unwrap();
    toast.success(`Order ${order.id} shipped via ${carrier}`);
    setStep('done');
  };

  return (
    <>
      <button onClick={() => router.push(`/orders/${order.id}`)} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to order
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Fulfill order {order.id}</h1>
          <div className="text-sm text-stone-500 mt-1 flex items-center gap-1.5">
            <CountryFlag destination={order.destination} />
            {order.customer} · {order.destination} · {order.itemsList.length} items · <Money value={order.total} />
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <Card className="mb-6 p-5">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const isCurrent = step === s.id;
            const isDone = stepIdx > i;
            return (
              <li key={s.id} className="flex flex-col items-center text-center relative">
                {i > 0 && (
                  <div className={clsx('absolute left-0 top-4 -translate-x-1/2 w-full h-px', isDone || isCurrent ? 'bg-brand-300' : 'bg-stone-200')} />
                )}
                <div className={clsx(
                  'w-8 h-8 rounded-full grid place-items-center mb-2 relative z-10 ring-4 ring-white',
                  isDone    ? 'bg-brand-600 text-white' :
                  isCurrent ? 'bg-brand-100 text-brand-700 ring-brand-50' :
                              'bg-stone-100 text-stone-400'
                )}>
                  {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : <s.Icon className="w-4 h-4" strokeWidth={2} />}
                </div>
                <div className={clsx('text-xs font-medium', isCurrent ? 'text-stone-900' : 'text-stone-500')}>{s.label}</div>
                <div className="text-2xs text-stone-500 hidden sm:block max-w-[120px]">{s.description}</div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Step content */}
      {step === 'pack' && (
        <Card className="p-6 mb-4">
          <h2 className="font-serif text-2xl text-stone-900 mb-1">Packing slip</h2>
          <p className="text-sm text-stone-500 mb-5">Print this slip and include it in the parcel. Customs declaration is included for cross-border orders.</p>

          <Alert variant="info" className="mb-5">
            Cross-border orders require a commercial invoice. The slip below combines packing details and the customs declaration.
          </Alert>

          <div className="border border-stone-200 rounded-lg p-6 bg-stone-50/30 mb-5">
            <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
              <div>
                <div className="font-serif text-2xl text-stone-900">PACKING SLIP</div>
                <div className="text-xs text-stone-500 mt-1">Order {order.id}</div>
              </div>
              <div className="text-right text-xs text-stone-600">
                <div><strong className="text-stone-900">From:</strong> Aysel Tekstil, Istanbul</div>
                <div className="mt-1"><strong className="text-stone-900">To:</strong></div>
                <div>{order.customer}</div>
                <div>{order.destinationFull}</div>
              </div>
            </div>
            <table className="w-full text-sm border-t border-stone-200">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 text-xs font-medium text-stone-600">SKU</th>
                  <th className="text-left py-2 text-xs font-medium text-stone-600">Item</th>
                  <th className="text-right py-2 text-xs font-medium text-stone-600">Qty</th>
                  <th className="text-right py-2 text-xs font-medium text-stone-600">Declared value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {order.itemsList.map((it, i) => (
                  <tr key={i}>
                    <td className="py-2 font-mono text-xs">{it.sku}</td>
                    <td className="py-2 text-stone-900">{it.name}</td>
                    <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-2 text-right tabular-nums"><Money value={it.price * it.quantity} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-200">
                  <td colSpan={3} className="py-2 text-right text-xs text-stone-600">Total declared value</td>
                  <td className="py-2 text-right tabular-nums font-medium"><Money value={order.subtotal} /></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-between flex-wrap gap-2">
            <Button onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print packing slip</Button>
            <Button variant="primary" onClick={() => setStep('pick')}>Continue → Pick items</Button>
          </div>
        </Card>
      )}

      {step === 'pick' && (
        <Card className="p-6 mb-4">
          <h2 className="font-serif text-2xl text-stone-900 mb-1">Pick items</h2>
          <p className="text-sm text-stone-500 mb-5">Tick each item as you pick it from inventory.</p>

          <div className="space-y-2 mb-5">
            {order.itemsList.map(it => {
              const isPicked = pickedItems.has(it.sku);
              return (
                <label
                  key={it.sku}
                  className={clsx(
                    'flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors',
                    isPicked ? 'bg-brand-50/50 border-brand-200' : 'bg-white border-stone-200 hover:bg-stone-50/50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isPicked}
                    onChange={e => setPickedItems(s => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(it.sku); else n.delete(it.sku);
                      return n;
                    })}
                    className="w-5 h-5 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
                  />
                  <div className="w-10 h-10 rounded-md bg-stone-100 grid place-items-center shrink-0">
                    <span className="font-serif text-base text-stone-500">{it.initial}</span>
                  </div>
                  <div className="flex-1">
                    <div className={clsx('text-sm', isPicked ? 'text-stone-500 line-through' : 'text-stone-900')}>{it.name}</div>
                    <div className="text-xs text-stone-500 font-mono">{it.sku}</div>
                  </div>
                  <div className="text-sm text-stone-700 tabular-nums">× {it.quantity}</div>
                </label>
              );
            })}
          </div>

          <div className="text-sm text-stone-600 mb-4">
            {pickedItems.size} of {order.itemsList.length} picked
          </div>

          <div className="flex justify-between flex-wrap gap-2">
            <Button onClick={() => setStep('pack')}>← Back</Button>
            <Button variant="primary" onClick={() => setStep('ship')} disabled={!allPicked}>
              Continue → Ship
            </Button>
          </div>
        </Card>
      )}

      {step === 'ship' && (
        <Card className="p-6 mb-4">
          <h2 className="font-serif text-2xl text-stone-900 mb-1">Ship</h2>
          <p className="text-sm text-stone-500 mb-5">Assign a carrier and enter the tracking number from your shipping label.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 max-w-2xl">
            <Field label="Carrier" required>
              <Select value={carrier} onChange={e => setCarrier(e.target.value)}>
                <option>DHL Express</option>
                <option>Aramex</option>
                <option>UPS</option>
                <option>FedEx International</option>
                <option>Local courier (Mogadishu)</option>
              </Select>
            </Field>
            <Field label="Tracking number" required>
              <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="JD012345678" className="font-mono" />
            </Field>
            <Field label="Package weight (kg)" hint="Used for shipping cost reconciliation">
              <Input type="number" step="0.01" min="0" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.5" />
            </Field>
          </div>

          <Alert variant="info" className="mb-5">
            On ship, the customer is emailed automatically with the tracking number. Order timeline is updated.
          </Alert>

          <div className="flex justify-between flex-wrap gap-2">
            <Button onClick={() => setStep('pick')}>← Back</Button>
            <Button variant="primary" onClick={doFulfill} disabled={shipping || !tracking.trim()}>
              <Truck className="w-3.5 h-3.5" /> Mark shipped & notify customer
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-100 grid place-items-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-brand-700" strokeWidth={2} />
          </div>
          <h2 className="font-serif text-3xl text-stone-900 mb-2">Order shipped 🎉</h2>
          <p className="text-sm text-stone-500 mb-1">Tracking <span className="font-mono text-stone-700">{tracking}</span> via {carrier}</p>
          <p className="text-sm text-stone-500 mb-6">{order.customer} has been notified by email.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => router.push(`/orders/${order.id}`)}>View order</Button>
            <Button variant="primary" onClick={() => router.push('/orders')}>Back to orders list</Button>
          </div>
        </Card>
      )}
    </>
  );
}
