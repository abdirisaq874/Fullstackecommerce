'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { Input } from '@/components/primitives/field';
import { DataTable, type Column } from '@/components/data/data-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { StockBar } from '@/components/inventory/stock-bar';
import { useListInventoryQuery } from '@/lib/api';
import type { InventoryRow } from '@/lib/types';
import clsx from 'clsx';

export default function InventoryPage() {
  const router = useRouter();
  const { data: inventory = [], isLoading, isError, refetch } = useListInventoryQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const filtered = useMemo(() => inventory.filter(r => {
    if (filter === 'out' && r.onHand !== 0) return false;
    if (filter === 'low' && (r.onHand === 0 || r.available > r.reorderThreshold)) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.sku.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q);
    }
    return true;
  }), [inventory, search, filter]);

  const counts = {
    all: inventory.length,
    low: inventory.filter(r => r.onHand > 0 && r.available <= r.reorderThreshold).length,
    out: inventory.filter(r => r.onHand === 0).length,
  };

  const columns: Column<InventoryRow>[] = [
    {
      key: 'sku', header: 'SKU',
      render: (r) => <span className="font-mono text-xs font-medium text-stone-900">{r.sku}</span>,
    },
    {
      key: 'product', header: 'Product',
      render: (r) => (
        <div>
          <div className="text-sm text-stone-900 truncate max-w-[260px]">{r.productName}</div>
          <div className="text-xs text-stone-500 truncate max-w-[260px]">{r.variantInfo}</div>
        </div>
      ),
    },
    {
      key: 'stock', header: 'Stock', className: 'min-w-[200px]',
      render: (r) => <StockBar onHand={r.onHand} available={r.available} reorderThreshold={r.reorderThreshold} />,
    },
    {
      key: 'reserved', header: 'Reserved', className: 'text-right',
      render: (r) => <span className="tabular-nums text-sm text-stone-600">{r.reserved}</span>,
    },
    {
      key: 'threshold', header: 'Reorder at', className: 'text-right',
      render: (r) => <span className="tabular-nums text-sm text-stone-500">{r.reorderThreshold}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        if (r.onHand === 0) return <Badge variant="danger">Out of stock</Badge>;
        if (r.available <= r.reorderThreshold) return <Badge variant="warning">Low stock</Badge>;
        return <Badge variant="success">In stock</Badge>;
      },
    },
    {
      key: 'warehouse', header: 'Warehouse',
      render: (r) => <span className="text-xs text-stone-500">{r.warehouse}</span>,
    },
  ];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            {counts.all} SKUs tracked
            {counts.low + counts.out > 0 && (
              <Badge variant="warning"><AlertTriangle className="w-3 h-3 mr-1" /> {counts.low + counts.out} need attention</Badge>
            )}
          </span>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
            {(['all', 'low', 'out'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={clsx(
                  'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5',
                  filter === opt ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900'
                )}
              >
                {opt === 'all' ? 'All' : opt === 'low' ? 'Low stock' : 'Out of stock'}
                <span className="text-stone-400">{counts[opt]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by SKU or product…" className="!pl-9" />
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No inventory rows" description="Inventory is created automatically when you add products with variants." />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={r => r.sku}
            onRowClick={(r) => router.push(`/inventory/${encodeURIComponent(r.sku)}`)}
          />
        )}
      </Card>
    </>
  );
}
