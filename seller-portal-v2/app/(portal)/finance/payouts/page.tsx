'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { Button } from '@/components/primitives/button';
import { DataTable, type Column } from '@/components/data/data-table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import {
  useListPayoutsQuery,
  type FinancePayout,
  type PayoutStatus,
} from '@/lib/api/finance-api';
import { formatCurrencyCents, formatDateShort, type BadgeVariant } from '@/lib/utils';

const PAGE_SIZE = 25;

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

export default function FinancePayoutsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useListPayoutsQuery({
    page,
    limit: PAGE_SIZE,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const columns: Column<FinancePayout>[] = [
    {
      key: 'period',
      header: 'Period',
      render: (p) => (
        <span className="text-sm text-stone-700">
          {formatDateShort(p.periodStart)} – {formatDateShort(p.periodEnd)}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (p) => (
        <span className="text-xs text-stone-500">{formatDateShort(p.createdAt)}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (p) => (
        <span className="tabular-nums">{formatCurrencyCents(p.amountCents, p.currency)}</span>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      className: 'text-right',
      render: (p) => (
        <span className="text-stone-500 tabular-nums">
          {formatCurrencyCents(p.feeCents, p.currency)}
        </span>
      ),
    },
    {
      key: 'net',
      header: 'Net',
      className: 'text-right',
      render: (p) => (
        <span className="font-medium tabular-nums text-stone-900">
          {formatCurrencyCents(p.netCents, p.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <Badge variant={payoutStatusVariant(p.status)}>{p.status}</Badge>,
    },
  ];

  return (
    <>
      <Link
        href="/finance"
        className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Back to finance
      </Link>

      <PageHeader
        title="Payouts"
        subtitle={
          meta
            ? `${meta.total} record${meta.total === 1 ? '' : 's'} · page ${meta.page} of ${meta.totalPages || 1}`
            : 'Disbursements to your bank account'
        }
      />

      <Card>
        {isError ? (
          <ErrorState onRetry={refetch} message="Couldn't load payouts." />
        ) : isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payouts yet"
            description="Payouts will appear here on your next disbursement cycle."
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={rows}
              rowKey={(p) => p.id ?? p._id ?? ''}
              onRowClick={(p) => router.push(`/finance/payouts/${p.id ?? p._id}`)}
            />
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-stone-200 text-xs text-stone-500">
                <span>
                  Showing {(meta.page - 1) * meta.limit + 1}–
                  {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!meta.hasPrev || isFetching}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!meta.hasNext || isFetching}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
