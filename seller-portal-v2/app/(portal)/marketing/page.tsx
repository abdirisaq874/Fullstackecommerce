'use client';

import { Plus, Tag } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { EmptyState } from '@/components/data/states';
import { DataTable, type Column } from '@/components/data/data-table';
import { db } from '@/lib/api/mock-db';
import type { Promotion } from '@/lib/types';

export default function MarketingPage() {
  const promotions = db.promotions;

  const columns: Column<Promotion>[] = [
    { key: 'code',     header: 'Code',     render: (p) => <span className="font-mono font-medium text-stone-900">{p.code}</span> },
    { key: 'discount', header: 'Discount', render: (p) => <Badge variant="info">{p.discount}</Badge> },
    {
      key: 'usage', header: 'Used',
      render: (p) => (
        <div className="text-sm">
          <span className="tabular-nums text-stone-900">{p.used}</span>
          <span className="text-stone-400"> / {p.limit ?? '∞'}</span>
        </div>
      ),
    },
    { key: 'expires', header: 'Expires', render: (p) => <span className="text-xs text-stone-500">{p.expires}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Discount codes and campaigns"
        actions={<Button variant="primary"><Plus className="w-3.5 h-3.5" /> New promotion</Button>}
      />
      <Card>
        {promotions.length === 0
          ? <EmptyState icon={Tag} title="No promotions" description="Create a discount code to drive sales." action={<Button variant="primary"><Plus className="w-3.5 h-3.5" /> New promotion</Button>} />
          : <DataTable columns={columns} data={promotions} rowKey={p => p.code} />}
      </Card>
    </>
  );
}
