'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, Package, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Alert } from '@/components/primitives/alert';
import { Field, Input, Select } from '@/components/primitives/field';
import { StockBar } from '@/components/inventory/stock-bar';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { useGetInventoryRowQuery, useAdjustInventoryMutation } from '@/lib/api';
import {
  adjustInventorySchema,
  type AdjustInventoryFormInput,
  type AdjustInventoryFormValues,
} from '@/lib/schemas/inventory';
import clsx from 'clsx';
import type { InventoryMovementType } from '@/lib/types';

const MOVEMENT_LABELS: Record<InventoryMovementType, { label: string; color: string }> = {
  sale:     { label: 'Sale',      color: 'text-stone-600' },
  received: { label: 'Received',  color: 'text-brand-700' },
  manual:   { label: 'Manual',    color: 'text-sky-700' },
  returned: { label: 'Returned',  color: 'text-amber-700' },
  damaged:  { label: 'Damaged',   color: 'text-red-600' },
};

export default function InventoryDetailPage({ params }: { params: { sku: string } }) {
  const router = useRouter();
  const sku = decodeURIComponent(params.sku);
  const { data: row, isLoading, isError, refetch } = useGetInventoryRowQuery(sku);
  const [adjust, { isLoading: adjusting }] = useAdjustInventoryMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<AdjustInventoryFormInput, unknown, AdjustInventoryFormValues>({
    resolver: zodResolver(adjustInventorySchema),
    defaultValues: { reason: 'receive', deltaQty: 0, notes: '' },
    mode: 'onBlur',
  });

  // Watched so the "New on-hand" preview and the disabled state on the
  // submit button react as the user types. `deltaQty` is coerced by zod,
  // but `watch` returns whatever react-hook-form currently holds, which
  // before submit can still be a string from the underlying input.
  const deltaQtyRaw = watch('deltaQty');
  const deltaNum = Number(deltaQtyRaw);
  const hasDelta = deltaQtyRaw !== undefined && deltaQtyRaw !== null && String(deltaQtyRaw).trim() !== '';

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !row) return <CardSkeleton height={400} />;

  const isOut = row.onHand === 0;
  const isLow = row.available <= row.reorderThreshold && !isOut;

  // The current `adjustInventory` mutation accepts a single `reason` string
  // and no separate notes field; combine the two so optional free-text from
  // the operator still reaches the backend without breaking the API
  // contract (the api layer is owned by C1-C7).
  const onSubmit: SubmitHandler<AdjustInventoryFormValues> = async (values) => {
    const num = values.deltaQty;
    const combinedReason = values.notes && values.notes.trim().length > 0
      ? `${values.reason}: ${values.notes.trim()}`
      : values.reason;
    await adjust({ sku: row.sku, delta: num, reason: combinedReason }).unwrap();
    toast.success(`${num > 0 ? '+' : ''}${num} adjustment applied`);
    reset({ reason: values.reason, deltaQty: 0, notes: '' });
  };

  const bumpDelta = (step: number) => {
    const current = Number(getValues('deltaQty')) || 0;
    setValue('deltaQty', current + step, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <>
      <button onClick={() => router.push('/inventory')} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to inventory
      </button>

      <PageHeader
        title={<span className="font-mono">{row.sku}</span>}
        subtitle={
          <Link href={`/products/${row.productId}/edit`} className="hover:text-stone-900">
            {row.productName} · {row.variantInfo}
          </Link>
        }
      />

      {(isOut || isLow) && (
        <Alert variant={isOut ? 'danger' : 'warning'} className="mb-6">
          <strong>{isOut ? 'Out of stock' : 'Below reorder threshold'}</strong> —{' '}
          {isOut
            ? 'No units available. Restock urgently to avoid lost sales.'
            : `Only ${row.available} units available (threshold: ${row.reorderThreshold}). Consider placing a reorder.`}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Stock overview */}
          <Card className="p-5">
            <h2 className="text-sm font-medium text-stone-900 mb-4">Current stock</h2>
            <div className="grid grid-cols-4 gap-4">
              <Stat label="On hand"     value={row.onHand}            tone="default" />
              <Stat label="Reserved"    value={row.reserved}          tone="default" />
              <Stat label="Available"   value={row.available}         tone={isOut ? 'danger' : isLow ? 'warning' : 'success'} />
              <Stat label="Reorder at"  value={row.reorderThreshold}  tone="muted"   />
            </div>
            <div className="mt-5">
              <StockBar onHand={row.onHand} available={row.available} reorderThreshold={row.reorderThreshold} />
            </div>
          </Card>

          {/* Movements log */}
          <Card>
            <CardHeader>
              <CardTitle>Recent movements</CardTitle>
              <Badge>{row.movements.length} entries</Badge>
            </CardHeader>
            <div className="divide-y divide-stone-100">
              {row.movements.map((m, i) => {
                const isPositive = m.delta > 0;
                const meta = MOVEMENT_LABELS[m.type];
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className={clsx(
                      'w-8 h-8 rounded-md grid place-items-center shrink-0',
                      isPositive ? 'bg-brand-50' : 'bg-stone-100'
                    )}>
                      {isPositive ? <TrendingUp className="w-4 h-4 text-brand-700" /> : <TrendingDown className="w-4 h-4 text-stone-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-stone-900">{m.reason}</div>
                      <div className={clsx('text-xs', meta.color)}>{meta.label}</div>
                    </div>
                    <div className={clsx(
                      'text-sm font-medium tabular-nums shrink-0',
                      isPositive ? 'text-brand-700' : 'text-stone-700'
                    )}>
                      {isPositive ? '+' : ''}{m.delta}
                    </div>
                    <div className="text-xs text-stone-500 shrink-0 w-24 text-right">{m.date}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Adjust panel */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-medium text-stone-900 mb-1">Manual adjustment</h2>
            <p className="text-xs text-stone-500 mb-4">Use for received shipments, damages, or audits.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
              <Field label="Reason" error={errors.reason?.message}>
                <Select
                  aria-invalid={Boolean(errors.reason)}
                  {...register('reason')}
                >
                  <option value="receive">Stock received</option>
                  <option value="damage">Damaged / written off</option>
                  <option value="audit">Audit correction</option>
                  <option value="correction">Correction</option>
                  <option value="transfer">Warehouse transfer</option>
                </Select>
              </Field>

              <Field
                label="Quantity change"
                hint="Positive to add, negative to remove"
                error={errors.deltaQty?.message}
              >
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    onClick={() => bumpDelta(-1)}
                    className="!w-8 !h-9 !p-0"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <Input
                    type="number"
                    placeholder="0"
                    className="!text-center tabular-nums"
                    aria-invalid={Boolean(errors.deltaQty)}
                    {...register('deltaQty')}
                  />
                  <Button
                    type="button"
                    onClick={() => bumpDelta(1)}
                    className="!w-8 !h-9 !p-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Field>

              <Field label="Note (optional)" error={errors.notes?.message}>
                <Input
                  placeholder="PO #1234 from Aysel Tekstil"
                  aria-invalid={Boolean(errors.notes)}
                  {...register('notes')}
                />
              </Field>

              {hasDelta && !Number.isNaN(deltaNum) && (
                <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-md">
                  New on-hand: <strong className="text-stone-900 tabular-nums">{row.onHand + deltaNum}</strong>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={adjusting || !hasDelta || deltaNum === 0 || Number.isNaN(deltaNum)}
                className="w-full"
              >
                Apply adjustment
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-stone-500 mb-3 font-medium">Warehouse</h3>
            <div className="text-sm text-stone-900">{row.warehouse}</div>
            <div className="text-xs text-stone-500 mt-1">Default fulfillment location</div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'default' | 'success' | 'warning' | 'danger' | 'muted' }) {
  const toneStyles = {
    default: 'text-stone-900',
    success: 'text-brand-700',
    warning: 'text-amber-700',
    danger:  'text-red-600',
    muted:   'text-stone-500',
  };
  return (
    <div>
      <div className="text-2xs text-stone-500 uppercase tracking-wide font-medium">{label}</div>
      <div className={clsx('font-serif text-3xl mt-1 tabular-nums', toneStyles[tone])}>{value}</div>
    </div>
  );
}
