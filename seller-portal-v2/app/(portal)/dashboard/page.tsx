'use client';

import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/dashboard/metric-card';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { TodayActionsCard, StoreHealthCard } from '@/components/dashboard/today-and-health';
import { ProfitTruthCard, ProductsLeaderboard } from '@/components/dashboard/profit-and-leaderboard';
import { ActionBoard } from '@/components/dashboard/action-board';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { Button } from '@/components/primitives/button';
import { Calendar, Download } from 'lucide-react';
import {
  useGetDashboardMetricsQuery, useGetWinningProductsQuery, useGetSlidingProductsQuery,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { data: m, isLoading, isError, refetch } = useGetDashboardMetricsQuery();
  const { data: winners = [] } = useGetWinningProductsQuery();
  const { data: sliders = [] } = useGetSlidingProductsQuery();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Good morning, Aysel"
        subtitle="Here's how your store is performing today"
        actions={
          <>
            <Button>
              <Calendar className="w-3.5 h-3.5" />
              This week
            </Button>
            <Button>
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
          </>
        }
      />

      {/* ─── Top KPI row (doc: gross sales, net revenue, profit, orders) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading || !m ? (
          <>
            <CardSkeleton height={130} /><CardSkeleton height={130} />
            <CardSkeleton height={130} /><CardSkeleton height={130} />
          </>
        ) : (
          <>
            <MetricCard label="Gross sales"  value={formatCurrency(m.grossSales)} delta="+12.4% vs last week" trend="up" />
            <MetricCard label="Net revenue"  value={formatCurrency(m.netRevenue)} delta="+9.8% vs last week"  trend="up" />
            <MetricCard label="Profit"       value={formatCurrency(m.profit)}     delta="+18.2% vs last week" trend="up" />
            <MetricCard label="Orders"       value={String(m.ordersThisWeek)}     hint={`${m.ordersToday} placed today`} />
          </>
        )}
      </div>

      {/* ─── Middle row: trend + profit truth ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          {isLoading || !m
            ? <CardSkeleton height={280} />
            : <TrendChart labels={m.weekLabels} revenue={m.weekRevenue} profit={m.weekProfit} />}
        </div>
        <div>
          {isLoading || !m
            ? <CardSkeleton height={280} />
            : <ProfitTruthCard grossSales={m.grossSales} costs={m.costs} profit={m.profit} />}
        </div>
      </div>

      {/* ─── Action layer: today actions + store health ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {isLoading || !m ? (
          <>
            <CardSkeleton height={300} />
            <CardSkeleton height={300} />
          </>
        ) : (
          <>
            <TodayActionsCard
              pendingFulfillment={m.pendingFulfillment}
              lowStockSkus={m.lowStockSkus}
              unrepliedMessages={m.unrepliedMessages}
              pendingReturns={m.pendingReturns}
            />
            <StoreHealthCard {...m.health} />
          </>
        )}
      </div>

      {/* ─── Product layer: winners and sliders ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ProductsLeaderboard title="Winning products"  subtitle="Strongest growth this week"  items={winners} direction="up" />
        <ProductsLeaderboard title="Sliding products"  subtitle="Need attention this week"    items={sliders} direction="down" />
      </div>

      {/* ─── Action board: Fix / Watch / Scale ─── */}
      <div className="mb-6">
        <div className="mb-3">
          <h2 className="font-serif text-2xl text-stone-900">Action board</h2>
          <p className="text-sm text-stone-500 mt-1">Where to spend your time today, organized by impact</p>
        </div>
        {isLoading || !m
          ? <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><CardSkeleton height={300} /><CardSkeleton height={300} /><CardSkeleton height={300} /></div>
          : <ActionBoard fix={m.actionBoard.fix} watch={m.actionBoard.watch} scale={m.actionBoard.scale} />}
      </div>
    </>
  );
}
