'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
// TODO (H5): migrate this page to <ResponsiveTable> so rows collapse to cards
// below the md breakpoint — see /orders and /products for the pattern.
import { DataTable, type Column } from '@/components/data/data-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { Money } from '@/components/shared/format';
import { useListReturnsQuery } from '@/lib/api';
import { statusVariant } from '@/lib/utils';
import type { Return, ReturnStatus } from '@/lib/types';
import clsx from 'clsx';

const REASON_LABELS: Record<string, string> = {
  'wrong-size': 'Wrong size',
  'wrong-item': 'Wrong item',
  'damaged': 'Damaged',
  'not-as-described': 'Not as described',
  'changed-mind': 'Changed mind',
  'other': 'Other',
};

const STATUS_FILTERS: { v: 'all' | ReturnStatus; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'requested', label: 'Requested' },
  { v: 'approved', label: 'Approved' },
  { v: 'received', label: 'Received' },
  { v: 'inspected', label: 'Inspected' },
  { v: 'refunded', label: 'Refunded' },
  { v: 'rejected', label: 'Rejected' },
];

export default function ReturnsPage() {
  const router = useRouter();
  const { data: returns = [], isLoading, isError, refetch } = useListReturnsQuery();
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]['v']>('all');

  const filtered = useMemo(() =>
    returns.filter(r => statusFilter === 'all' || r.status === statusFilter),
    [returns, statusFilter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: returns.length };
    for (const r of returns) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [returns]);

  const columns: Column<Return>[] = [
    { key: 'id', header: 'RMA', render: (r) => <span className="font-mono text-xs font-medium text-stone-900">{r.id}</span> },
    {
      key: 'order', header: 'Order',
      render: (r) => <span className="font-mono text-xs text-stone-600">{r.orderId}</span>,
    },
    {
      key: 'customer', header: 'Customer',
      render: (r) => (
        <div>
          <div className="text-sm text-stone-900">{r.customer}</div>
          <div className="text-xs text-stone-500">{r.customerEmail}</div>
        </div>
      ),
    },
    {
      key: 'items', header: 'Items',
      render: (r) => (
        <div className="text-sm text-stone-700">
          {r.items.length} item{r.items.length === 1 ? '' : 's'}
          <div className="text-xs text-stone-500 truncate max-w-[200px]">{r.items[0]?.name}{r.items.length > 1 ? ` + ${r.items.length - 1} more` : ''}</div>
        </div>
      ),
    },
    {
      key: 'reason', header: 'Reason',
      render: (r) => <span className="text-stone-700 text-sm">{REASON_LABELS[r.reason] ?? r.reason}</span>,
    },
    {
      key: 'refund', header: 'Refund',
      render: (r) => <span className="font-medium tabular-nums"><Money value={r.refundAmount} /></span>,
    },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: 'date', header: 'Requested', render: (r) => <span className="text-xs text-stone-500">{r.requestedAt}</span> },
  ];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Returns"
        subtitle={`${returns.length} total · ${(counts.requested ?? 0) + (counts.received ?? 0) + (counts.inspected ?? 0)} need action`}
      />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md w-fit flex-wrap">
          {STATUS_FILTERS.map(opt => (
            <button
              key={opt.v}
              onClick={() => setStatusFilter(opt.v)}
              className={clsx(
                'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5',
                statusFilter === opt.v ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900'
              )}
            >
              {opt.label}
              <span className="text-stone-400">{counts[opt.v as string] ?? 0}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No returns" description="Return requests from customers will appear here." />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={r => r.id}
            onRowClick={(r) => router.push(`/returns/${r.id}`)}
          />
        )}
      </Card>
    </>
  );
}
