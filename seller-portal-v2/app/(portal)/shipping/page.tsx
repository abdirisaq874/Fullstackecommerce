'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { Button } from '@/components/primitives/button';
import { DataTable, type Column } from '@/components/data/data-table';
import { Money } from '@/components/shared/format';
import { db } from '@/lib/api/mock-db';
import { statusVariant } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { ShippingZone } from '@/lib/types';

export default function ShippingPage() {
  const zones = db.shippingZones;

  const columns: Column<ShippingZone>[] = [
    { key: 'destination', header: 'Destination', render: (z) => <span className="text-stone-900 font-medium">{z.destination}</span> },
    { key: 'lead',        header: 'Lead time',  render: (z) => <span className="text-stone-700">{z.leadTime}</span> },
    { key: 'rate',        header: 'Base rate',  render: (z) => <span className="font-medium tabular-nums"><Money value={z.baseRate} /></span> },
    { key: 'status',      header: 'Status',     render: (z) => <Badge variant={statusVariant(z.status)}>{z.status}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Shipping"
        subtitle="Destinations, lead times, and base rates"
        actions={<Button variant="primary"><Plus className="w-3.5 h-3.5" /> Add zone</Button>}
      />
      <Card>
        <DataTable columns={columns} data={zones} rowKey={z => z.destination} />
      </Card>
    </>
  );
}
