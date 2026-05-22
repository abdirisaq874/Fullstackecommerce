'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, X, RotateCcw, Package, Mail } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Alert } from '@/components/primitives/alert';
import { Field, Input, Select, Textarea } from '@/components/primitives/field';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { Money } from '@/components/shared/format';
import { useGetReturnQuery, useSetReturnStatusMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { statusVariant } from '@/lib/utils';
import type { ReturnStatus, RefundDecision } from '@/lib/types';

const REASON_LABELS: Record<string, string> = {
  'wrong-size': 'Wrong size',
  'wrong-item': 'Wrong item received',
  'damaged': 'Arrived damaged',
  'not-as-described': 'Not as described',
  'changed-mind': 'Changed mind',
  'other': 'Other',
};

const STATE_FLOW: ReturnStatus[] = ['requested', 'approved', 'received', 'inspected', 'refunded'];

export default function ReturnDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: ret, isLoading, isError, refetch } = useGetReturnQuery(params.id);
  const [setStatus, { isLoading: updating }] = useSetReturnStatusMutation();
  const toast = useToast();

  const [decision, setDecision] = useState<RefundDecision>('full-refund');
  const [refundAmount, setRefundAmount] = useState('');
  const [note, setNote] = useState('');

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !ret) return <CardSkeleton height={400} />;

  const totalRequested = ret.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const currentIdx = STATE_FLOW.indexOf(ret.status);

  const advance = async (next: ReturnStatus, extra: Partial<Parameters<typeof setStatus>[0]> = {}) => {
    await setStatus({ id: ret.id, status: next, ...extra });
    toast.success(`Return ${next}`);
  };

  const reject = async () => {
    if (!confirm('Reject this return request? The customer will be notified.')) return;
    await setStatus({ id: ret.id, status: 'rejected', refundAmount: 0 });
    toast.success('Return rejected');
  };

  return (
    <>
      <button onClick={() => router.push('/returns')} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to returns
      </button>

      <PageHeader
        title={`Return ${ret.id}`}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge variant={statusVariant(ret.status)}>{ret.status}</Badge> · Requested {ret.requestedAt} · Order <Link href={`/orders/${ret.orderId}`} className="font-mono text-stone-700 hover:text-stone-900">{ret.orderId}</Link>
          </span>
        }
      />

      {/* State flow */}
      {ret.status !== 'rejected' && (
        <Card className="mb-6 p-5">
          <ol className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {STATE_FLOW.map((s, i) => (
              <li key={s} className="flex items-center gap-1 shrink-0">
                <div className={
                  'flex items-center gap-2 px-3 py-1.5 rounded text-xs whitespace-nowrap ' +
                  (i === currentIdx ? 'bg-brand-100 text-brand-800 font-medium' :
                   i  < currentIdx ? 'bg-stone-100 text-stone-600' :
                                     'bg-stone-50 text-stone-400')
                }>
                  {i < currentIdx
                    ? <Check className="w-3 h-3" strokeWidth={3} />
                    : <span className={`w-1.5 h-1.5 rounded-full ${i === currentIdx ? 'bg-brand-600' : 'bg-stone-300'}`} />
                  }
                  {s}
                </div>
                {i < STATE_FLOW.length - 1 && <div className={'w-3 h-px ' + (i < currentIdx ? 'bg-stone-300' : 'bg-stone-200')} />}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Return reason</CardTitle>
              <Badge>{REASON_LABELS[ret.reason]}</Badge>
            </CardHeader>
            {ret.reasonNote && (
              <div className="px-5 py-3 text-sm text-stone-700 bg-stone-50/40 border-t border-stone-100">
                <div className="text-xs text-stone-500 uppercase tracking-wide mb-1">Customer note</div>
                "{ret.reasonNote}"
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{ret.items.length} item{ret.items.length === 1 ? '' : 's'} being returned</CardTitle>
            </CardHeader>
            <div className="divide-y divide-stone-100">
              {ret.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-12 h-12 rounded-md bg-stone-100 grid place-items-center shrink-0 ring-1 ring-stone-200">
                    <span className="font-serif text-base text-stone-500">{item.initial}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-900 truncate">{item.name}</div>
                    <div className="text-xs text-stone-500 font-mono mt-0.5">{item.sku}</div>
                    <div className="text-xs text-stone-500 mt-1.5">
                      {item.restockable
                        ? <Badge variant="success">Restockable</Badge>
                        : <Badge variant="warning">Not restockable</Badge>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-stone-700 tabular-nums">× {item.quantity}</div>
                    <div className="text-sm text-stone-900 font-medium tabular-nums">
                      <Money value={item.price * item.quantity} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-200 px-5 py-2.5 text-sm flex justify-between">
              <span className="text-stone-500">Total declared value</span>
              <span className="font-medium tabular-nums"><Money value={totalRequested} /></span>
            </div>
          </Card>

          {/* Action panel — varies by state */}
          {ret.status === 'requested' && (
            <Card className="p-5">
              <h3 className="text-sm font-medium text-stone-900 mb-3">Approve or reject this return</h3>
              <p className="text-sm text-stone-600 mb-4">
                Approving will send the customer return shipping instructions. Rejecting closes the request.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => advance('approved')} disabled={updating}>
                  <Check className="w-3.5 h-3.5" /> Approve & send instructions
                </Button>
                <Button variant="danger-ghost" onClick={reject} disabled={updating}>
                  <X className="w-3.5 h-3.5" /> Reject return
                </Button>
              </div>
            </Card>
          )}

          {ret.status === 'approved' && (
            <Card className="p-5">
              <h3 className="text-sm font-medium text-stone-900 mb-3">Mark items as received</h3>
              <p className="text-sm text-stone-600 mb-4">When the parcel arrives back at your warehouse.</p>
              <Button variant="primary" onClick={() => advance('received')} disabled={updating}>
                <Package className="w-3.5 h-3.5" /> Mark received
              </Button>
            </Card>
          )}

          {ret.status === 'received' && (
            <Card className="p-5">
              <h3 className="text-sm font-medium text-stone-900 mb-3">Inspect and decide</h3>
              <p className="text-sm text-stone-600 mb-4">Once items are inspected, choose how to resolve.</p>
              <div className="space-y-3 max-w-md">
                <Field label="Decision">
                  <Select value={decision} onChange={e => setDecision(e.target.value as RefundDecision)}>
                    <option value="full-refund">Full refund</option>
                    <option value="partial-refund">Partial refund (with restocking fee)</option>
                    <option value="replace">Send replacement</option>
                    <option value="reject">Reject (not eligible)</option>
                  </Select>
                </Field>
                {(decision === 'full-refund' || decision === 'partial-refund') && (
                  <Field label="Refund amount" hint="Customer's original payment will be refunded">
                    <Input
                      type="number" step="0.01" min="0"
                      value={refundAmount || (decision === 'full-refund' ? String(totalRequested) : '')}
                      onChange={e => setRefundAmount(e.target.value)}
                      placeholder={String(totalRequested)}
                    />
                  </Field>
                )}
                <Field label="Internal note (optional)">
                  <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Items returned in good condition…" />
                </Field>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="primary"
                  onClick={() => advance('inspected', { decision, refundAmount: Number(refundAmount) || totalRequested })}
                  disabled={updating}
                >
                  Save inspection
                </Button>
              </div>
            </Card>
          )}

          {ret.status === 'inspected' && ret.decision !== 'reject' && (
            <Card className="p-5">
              <h3 className="text-sm font-medium text-stone-900 mb-3">Issue refund</h3>
              <p className="text-sm text-stone-600 mb-4">
                Refund of <strong className="text-stone-900"><Money value={ret.refundAmount} /></strong> will be sent to the customer's original payment method.
              </p>
              <Button
                variant="primary"
                onClick={() => advance('refunded')}
                disabled={updating}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Issue refund
              </Button>
            </Card>
          )}

          {ret.status === 'refunded' && (
            <Alert variant="success">
              Refund of <strong><Money value={ret.refundAmount} /></strong> issued on {ret.refundedAt}.
              {ret.restockingFee ? <> Restocking fee of <Money value={ret.restockingFee} /> withheld.</> : null}
            </Alert>
          )}

          {ret.status === 'rejected' && (
            <Alert variant="danger">
              Return rejected. The customer has been notified.
            </Alert>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-medium">Customer</h3>
            <div className="text-sm text-stone-900 font-medium">{ret.customer}</div>
            <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {ret.customerEmail}</div>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-medium">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-stone-500">Items</span><span className="tabular-nums">{ret.items.length}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Original total</span><span className="tabular-nums"><Money value={totalRequested} /></span></div>
              <div className="flex justify-between pt-2 border-t border-stone-100">
                <span className="text-stone-500">Refund amount</span>
                <span className="tabular-nums font-medium"><Money value={ret.refundAmount} /></span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
