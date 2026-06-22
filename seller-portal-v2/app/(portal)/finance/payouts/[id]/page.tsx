'use client';

import Link from 'next/link';
import { use } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { ErrorState, CardSkeleton } from '@/components/data/states';
import { useGetPayoutQuery, type PayoutStatus } from '@/lib/api/finance-api';
import { formatCurrencyCents, formatDateShort, type BadgeVariant } from '@/lib/utils';

function payoutStatusVariant(s: PayoutStatus): BadgeVariant {
  switch (s) {
    case 'paid':
      return 'success';
    case 'processing':
    case 'pending':
      return 'warning';
    case 'failed':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

interface PageProps {
  // Next.js 15: dynamic route params are a Promise. We unwrap with React.use().
  params: Promise<{ id: string }>;
}

export default function PayoutDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: payout, isLoading, isError, refetch } = useGetPayoutQuery(id);

  return (
    <>
      <Link
        href="/finance/payouts"
        className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Back to payouts
      </Link>

      <PageHeader
        title="Payout detail"
        subtitle={payout ? `Period ${formatDateShort(payout.periodStart)} – ${formatDateShort(payout.periodEnd)}` : undefined}
        actions={payout ? <Badge variant={payoutStatusVariant(payout.status)}>{payout.status}</Badge> : undefined}
      />

      {isError ? (
        <Card>
          <ErrorState onRetry={refetch} message="Couldn't load this payout." />
        </Card>
      ) : isLoading || !payout ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton height={120} />
          <CardSkeleton height={120} />
          <CardSkeleton height={120} />
        </div>
      ) : (
        <>
          {/* ─── Amount summary ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <div className="text-xs text-stone-500 uppercase tracking-wide font-medium">Gross amount</div>
              <div className="font-serif text-3xl text-stone-900 mt-2 tabular-nums">
                {formatCurrencyCents(payout.amountCents, payout.currency)}
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <div className="text-xs text-stone-500 uppercase tracking-wide font-medium">Platform fee</div>
              <div className="font-serif text-3xl text-stone-900 mt-2 tabular-nums">
                {formatCurrencyCents(payout.feeCents, payout.currency)}
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <div className="text-xs text-stone-500 uppercase tracking-wide font-medium">Net payout</div>
              <div className="font-serif text-3xl text-brand-700 mt-2 tabular-nums">
                {formatCurrencyCents(payout.netCents, payout.currency)}
              </div>
            </div>
          </div>

          {/* ─── Metadata ─── */}
          <Card className="mb-6">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-sm font-medium text-stone-900">Details</h2>
            </div>
            <dl className="divide-y divide-stone-100 text-sm">
              <Row label="Payout ID" value={<span className="font-mono text-xs">{payout.id ?? payout._id}</span>} />
              <Row label="Status" value={<Badge variant={payoutStatusVariant(payout.status)}>{payout.status}</Badge>} />
              <Row label="Period start" value={formatDateShort(payout.periodStart)} />
              <Row label="Period end" value={formatDateShort(payout.periodEnd)} />
              <Row label="Currency" value={payout.currency} />
              <Row label="Created" value={formatDateShort(payout.createdAt)} />
              <Row label="Paid at" value={payout.paidAt ? formatDateShort(payout.paidAt) : '—'} />
              <Row
                label="Stripe payout ID"
                value={
                  payout.stripePayoutId ? (
                    <span className="font-mono text-xs">{payout.stripePayoutId}</span>
                  ) : (
                    <span className="text-stone-400">Not assigned</span>
                  )
                }
              />
            </dl>
          </Card>
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-stone-500 font-medium">{label}</dt>
      <dd className="text-stone-900 text-right">{value}</dd>
    </div>
  );
}
