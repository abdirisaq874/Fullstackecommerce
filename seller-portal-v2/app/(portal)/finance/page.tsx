'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart3, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { MetricCard } from '@/components/dashboard/metric-card';
import { DataTable, type Column } from '@/components/data/data-table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import {
  useGetBalanceQuery,
  useListTransactionsQuery,
  useListPayoutsQuery,
  type FinanceTransaction,
  type FinancePayout,
  type PayoutStatus,
} from '@/lib/api/finance-api';
import {
  formatCurrencyCents,
  formatDateShort,
  formatRelativeTime,
  type BadgeVariant,
} from '@/lib/utils';

/**
 * Finance overview page.
 *
 * Wired to backend F5 (`/seller/finance/*`):
 *  - GET /balance         → headline metric cards
 *  - GET /transactions    → top 20 recent transactions
 *  - GET /payouts         → top 10 recent payouts
 *
 * Each table has a "View all" link to a paginated full-list page under
 * `/finance/transactions` and `/finance/payouts`.
 */

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

export default function FinancePage() {
  const router = useRouter();

  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceError,
    refetch: refetchBalance,
  } = useGetBalanceQuery();

  const {
    data: txResp,
    isLoading: txLoading,
    isError: txError,
    refetch: refetchTx,
  } = useListTransactionsQuery({ page: 1, limit: 20 });

  const {
    data: payoutsResp,
    isLoading: payoutsLoading,
    isError: payoutsError,
    refetch: refetchPayouts,
  } = useListPayoutsQuery({ page: 1, limit: 10 });

  const currency = balance?.currency ?? 'USD';

  // ─── Transactions table ───────────────────────────────────────────────────
  const txColumns: Column<FinanceTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (t) => <span className="text-xs text-stone-500">{formatDateShort(t.createdAt)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (t) => (
        <Badge variant={t.type === 'refund' ? 'danger' : 'success'}>{t.type}</Badge>
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
    {
      key: 'order',
      header: 'Order',
      render: (t) => (
        <Link
          href={`/orders/${t.orderId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-brand-700 hover:text-brand-800"
        >
          {t.orderNumber ?? t.orderId}
        </Link>
      ),
    },
  ];

  // ─── Payouts table ─────────────────────────────────────────────────────────
  const payoutColumns: Column<FinancePayout>[] = [
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
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      render: (p) => (
        <span className="font-medium tabular-nums">
          {formatCurrencyCents(p.netCents ?? p.amountCents, p.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge variant={payoutStatusVariant(p.status)}>{p.status}</Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Balances, payouts and transactions"
        actions={
          <Link href="/finance/reports">
            <Button>
              <BarChart3 className="w-3.5 h-3.5" /> Reports
            </Button>
          </Link>
        }
      />

      {/* ─── Top stat cards ─── */}
      {balanceError ? (
        <Card className="mb-6">
          <ErrorState onRetry={refetchBalance} message="Couldn't load your balance." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Available balance"
            value={balanceLoading ? '—' : formatCurrencyCents(balance?.availableCents ?? 0, currency)}
            hint="Eligible for next payout"
          />
          <MetricCard
            label="Pending balance"
            value={balanceLoading ? '—' : formatCurrencyCents(balance?.pendingCents ?? 0, currency)}
            hint="Awaiting payment clearance"
          />
          <MetricCard
            label="Lifetime net"
            value={balanceLoading ? '—' : formatCurrencyCents(balance?.lifetimeNetCents ?? 0, currency)}
            hint="All-time after platform fees"
          />
          <MetricCard
            label="Next payout"
            value={balanceLoading ? '—' : formatRelativeTime(balance?.nextPayoutAt)}
            hint={balance?.nextPayoutAt ? formatDateShort(balance.nextPayoutAt) : 'No payout scheduled'}
          />
        </div>
      )}

      {/* ─── Two-column tables ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent transactions (top 20) — span 2/3 */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <Link
              href="/finance/transactions"
              className="text-xs text-brand-700 hover:text-brand-800 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          {txError ? (
            <ErrorState onRetry={refetchTx} message="Couldn't load transactions." />
          ) : txLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (txResp?.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No transactions yet"
              description="Your settled orders and refunds will show up here."
            />
          ) : (
            <DataTable
              columns={txColumns}
              data={txResp!.data}
              rowKey={(t) => t.id}
            />
          )}
        </Card>

        {/* Recent payouts (top 10) — span 1/3 */}
        <Card>
          <CardHeader>
            <CardTitle>Recent payouts</CardTitle>
            <Link
              href="/finance/payouts"
              className="text-xs text-brand-700 hover:text-brand-800 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          {payoutsError ? (
            <ErrorState onRetry={refetchPayouts} message="Couldn't load payouts." />
          ) : payoutsLoading ? (
            <TableSkeleton rows={6} columns={3} />
          ) : (payoutsResp?.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payouts yet"
              description="Payouts will appear here on your next disbursement."
            />
          ) : (
            <DataTable
              columns={payoutColumns}
              data={payoutsResp!.data}
              rowKey={(p) => p.id ?? p._id ?? ''}
              onRowClick={(p) => router.push(`/finance/payouts/${p.id ?? p._id}`)}
            />
          )}
        </Card>
      </div>
    </>
  );
}
