'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { Button } from '@/components/primitives/button';
import { DataTable, type Column } from '@/components/data/data-table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import {
  useListTransactionsQuery,
  useGetBalanceQuery,
  type FinanceTransaction,
} from '@/lib/api/finance-api';
import { formatCurrencyCents, formatDateShort } from '@/lib/utils';

const PAGE_SIZE = 25;

export default function FinanceTransactionsPage() {
  const [page, setPage] = useState(1);

  const { data: balance } = useGetBalanceQuery();
  const currency = balance?.currency ?? 'USD';

  const { data, isLoading, isError, refetch, isFetching } =
    useListTransactionsQuery({ page, limit: PAGE_SIZE });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const columns: Column<FinanceTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (t) => (
        <span className="text-xs text-stone-500">{formatDateShort(t.createdAt)}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (t) => (
        <Badge variant={t.type === 'refund' ? 'danger' : 'success'}>{t.type}</Badge>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (t) => (
        <Link
          href={`/orders/${t.orderId}`}
          className="font-mono text-xs text-brand-700 hover:text-brand-800"
        >
          {t.orderNumber ?? t.orderId}
        </Link>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (t) => (
        <span className="font-medium tabular-nums">
          {formatCurrencyCents(t.amountCents, currency)}
        </span>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      className: 'text-right',
      render: (t) => (
        <span className="text-stone-500 tabular-nums">
          {formatCurrencyCents(t.feeCents, currency)}
        </span>
      ),
    },
    {
      key: 'net',
      header: 'Net',
      className: 'text-right',
      render: (t) => (
        <span className="font-medium tabular-nums text-stone-900">
          {formatCurrencyCents(t.netCents, currency)}
        </span>
      ),
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
        title="Transactions"
        subtitle={
          meta
            ? `${meta.total} record${meta.total === 1 ? '' : 's'} · page ${meta.page} of ${meta.totalPages || 1}`
            : 'Sales and refunds across all orders'
        }
      />

      <Card>
        {isError ? (
          <ErrorState onRetry={refetch} message="Couldn't load transactions." />
        ) : isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions"
            description="Sales and refunds will appear here once your store starts trading."
          />
        ) : (
          <>
            <DataTable columns={columns} data={rows} rowKey={(t) => t.id} />
            {/* Pager */}
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
