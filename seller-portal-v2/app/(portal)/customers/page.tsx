'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { DataTable, type Column } from '@/components/data/data-table';
import { Money } from '@/components/shared/format';
import { db } from '@/lib/api/mock-db';
import type { Customer } from '@/lib/types';

export default function CustomersPage() {
  const customers = db.customers;

  const columns: Column<Customer>[] = [
    {
      key: 'name', header: 'Customer',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-stone-200 text-stone-700 grid place-items-center font-medium text-sm shrink-0">
            {c.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div className="text-sm text-stone-900 font-medium">{c.name}</div>
            <div className="text-xs text-stone-500">{c.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'country',  header: 'Country',     render: (c) => <Badge>{c.country}</Badge> },
    { key: 'orders',   header: 'Orders',      render: (c) => <span className="tabular-nums">{c.orders}</span>, className: 'text-right' },
    { key: 'lifetime', header: 'Lifetime',    render: (c) => <span className="font-medium tabular-nums"><Money value={c.lifetime} /></span>, className: 'text-right' },
    { key: 'last',     header: 'Last order',  render: (c) => <span className="text-xs text-stone-500">{c.lastOrder}</span> },
  ];

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.length} buyers across the corridor`} />
      <Card>
        <DataTable columns={columns} data={customers} rowKey={c => c.id} />
      </Card>
    </>
  );
}
