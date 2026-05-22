'use client';

import Link from 'next/link';
import { BarChart3, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { MetricCard } from '@/components/dashboard/metric-card';
import { DataTable, type Column } from '@/components/data/data-table';
import { Money } from '@/components/shared/format';
import { db } from '@/lib/api/mock-db';
import { formatCurrency } from '@/lib/utils';
import type { Transaction } from '@/lib/types';
import clsx from 'clsx';

export default function FinancePage() {
  const transactions = db.transactions;
  const available = 2847.20;
  const pending = 1230.50;

  const columns: Column<Transaction>[] = [
    { key: 'desc', header: 'Description', render: (t) => <span className="text-stone-900">{t.description}</span> },
    {
      key: 'amount', header: 'Amount', className: 'text-right',
      render: (t) => (
        <span className={clsx('font-medium tabular-nums', t.amount < 0 ? 'text-red-600' : 'text-stone-900')}>
          {t.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(t.amount))}
        </span>
      ),
    },
    { key: 'fee',  header: 'Fee',  render: (t) => <span className="text-xs text-stone-500 tabular-nums">{t.fee > 0 ? formatCurrency(t.fee) : '—'}</span>, className: 'text-right' },
    { key: 'date', header: 'Date', render: (t) => <span className="text-xs text-stone-500">{t.date}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Balances, payouts and transactions"
        actions={
          <Link href="/finance/reports">
            <Button><BarChart3 className="w-3.5 h-3.5" /> Reports</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Available balance" value={formatCurrency(available)} hint="Eligible for next payout" />
        <MetricCard label="Pending"           value={formatCurrency(pending)}   hint="Awaiting payment clearance" />
        <MetricCard label="Next payout"       value="May 15" hint="Scheduled — $2,847.20" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <Link href="/finance/reports" className="text-xs text-brand-700 hover:text-brand-800 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <DataTable columns={columns} data={transactions} rowKey={t => t.id} />
      </Card>
    </>
  );
}
