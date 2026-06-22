'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Search, Download, Truck, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Input } from '@/components/primitives/field';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/data/responsive-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { Money, CountryFlag } from '@/components/shared/format';
import { useListOrdersQuery, useSetOrderStatusMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { statusVariant, toCSV, downloadCSV } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';
import clsx from 'clsx';

const STATUS_FILTERS: { v: 'all' | OrderStatus; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'new', label: 'New' },
  { v: 'confirmed', label: 'Confirmed' },
  { v: 'processing', label: 'Processing' },
  { v: 'shipped', label: 'Shipped' },
  { v: 'delivered', label: 'Delivered' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { data: orders = [], isLoading, isError, refetch } = useListOrdersQuery();
  const [setStatus] = useSetOrderStatusMutation();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]['v']>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.id.toLowerCase().includes(q) && !o.customer.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [orders, statusFilter, search]);

  const counts = useMemo(() => ({
    all: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }), [orders]);

  const bulkMark = async (status: OrderStatus) => {
    for (const id of selected) await setStatus({ id, status });
    toast.success(`${selected.size} orders updated`);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const rows = (selected.size ? filtered.filter(o => selected.has(o.id)) : filtered).map(o => ({
      id: o.id, customer: o.customer, destination: o.destination,
      status: o.status, total: o.total, items: o.items, date: o.date,
    }));
    const csv = toCSV(rows, [
      { key: 'id', label: 'Order ID' }, { key: 'customer', label: 'Customer' },
      { key: 'destination', label: 'Destination' }, { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total' }, { key: 'items', label: 'Items' }, { key: 'date', label: 'Date' },
    ]);
    downloadCSV(`orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${rows.length} orders`);
  };

  const columns: ResponsiveColumn<Order>[] = [
    { key: 'id', header: 'Order', mobileHidden: true, render: (o) => <span className="font-mono text-xs font-medium text-stone-900">{o.id}</span> },
    {
      key: 'customer', header: 'Customer',
      mobilePrimary: true,
      render: (o) => (
        <div>
          <div className="text-sm text-stone-900 font-medium">{o.customer}</div>
          <div className="text-xs text-stone-500 flex items-center gap-1">
            <CountryFlag destination={o.destination} /> {o.destination}
          </div>
          <div className="md:hidden text-2xs font-mono text-stone-400 mt-0.5">{o.id}</div>
        </div>
      ),
    },
    { key: 'items', header: 'Items', render: (o) => <span className="tabular-nums text-stone-700">{o.items}</span> },
    { key: 'total', header: 'Total', render: (o) => <span className="font-medium tabular-nums"><Money value={o.total} /></span> },
    {
      key: 'payment', header: 'Payment',
      render: (o) => <span className="text-xs text-stone-500 truncate inline-block max-w-[140px]">{o.paymentMethod}</span>,
    },
    { key: 'status', header: 'Status', render: (o) => <Badge variant={statusVariant(o.status)}>{o.status}</Badge> },
    { key: 'date', header: 'Placed', render: (o) => <span className="text-xs text-stone-500">{o.date}</span> },
  ];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} total · ${counts.processing + counts.confirmed} need attention`}
        actions={<Button onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export</Button>}
      />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
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
                <span className="text-stone-400">{counts[opt.v as keyof typeof counts] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order ID or customer…" className="!pl-9" />
          </div>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="mb-4 p-3 bg-brand-50/40 border-brand-200">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-brand-900 font-medium">{selected.size} selected</div>
            <div className="h-4 w-px bg-brand-200" />
            <Button onClick={() => bulkMark('processing')}>Mark processing</Button>
            <Button onClick={() => bulkMark('packed')}>Mark packed</Button>
            <Button onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export</Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-stone-500 hover:text-stone-900 p-1"
              aria-label="Clear order selection"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No orders found" description="When buyers check out, their orders show up here." />
        ) : (
          <ResponsiveTable
            columns={columns}
            data={filtered}
            rowKey={o => o.id}
            selectable
            selectedIds={selected}
            onSelect={(id, checked) => setSelected(s => { const n = new Set(s); checked ? n.add(id) : n.delete(id); return n; })}
            onSelectAll={(checked) => setSelected(checked ? new Set(filtered.map(o => o.id)) : new Set())}
            onRowClick={(o) => router.push(`/orders/${o.id}`)}
          />
        )}
      </Card>
    </>
  );
}
