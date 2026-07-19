'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/dashboard/metric-card';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { TodayActionsCard, StoreHealthCard } from '@/components/dashboard/today-and-health';
import { ProfitTruthCard, ProductsLeaderboard } from '@/components/dashboard/profit-and-leaderboard';
import { ActionBoard } from '@/components/dashboard/action-board';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { Button } from '@/components/primitives/button';
import { Calendar, Download, ArrowRight, Sparkles } from 'lucide-react';
import {
  useGetDashboardMetricsQuery, useGetWinningProductsQuery, useGetSlidingProductsQuery,
} from '@/lib/api';
import { useGetSettingsQuery } from '@/lib/api/seller-settings-api';
import { useListMyStoresQuery } from '@/lib/api/stores-api';
import { getActiveStoreId } from '@/lib/api/base-api';
import { useAppSelector } from '@/lib/api/store';
import { selectCurrentUser } from '@/lib/store/auth-slice';
import { formatCurrency } from '@/lib/utils';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { data: m, isLoading, isError, refetch } = useGetDashboardMetricsQuery();
  const { data: winners = [] } = useGetWinningProductsQuery();
  const { data: sliders = [] } = useGetSlidingProductsQuery();

  // Real, time-aware greeting: "<time>, <first name>", falling back to the
  // active store's name, then a neutral word. The hour is read on the client
  // only (the server has no clock/timezone for the user) to avoid a hydration
  // mismatch, so we start neutral and refine after mount.
  const user = useAppSelector(selectCurrentUser);
  const { data: stores = [] } = useListMyStoresQuery();
  const activeStore = stores.find((s) => s._id === getActiveStoreId()) ?? stores[0];
  const greetingName = user?.firstName?.trim() || activeStore?.displayName?.trim() || 'there';
  const [greeting, setGreeting] = useState('Hello');
  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);
  // Onboarding (H10): show a welcome card on dashboards when the seller
  // hasn't filled in their store profile yet. We treat an empty
  // displayName as the trigger — settings are auto-created on first read,
  // so this just means a brand-new seller.
  const { data: settings } = useGetSettingsQuery();
  const showOnboardingCard =
    settings !== undefined && !settings.storeProfile?.displayName?.trim();

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${greetingName}`}
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

      {showOnboardingCard && (
        <div className="mb-6 rounded-lg border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 flex items-start gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-full bg-brand-100 grid place-items-center shrink-0">
            <Sparkles className="w-5 h-5 text-brand-700" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-[16rem]">
            <h2 className="font-serif text-lg text-stone-900">Welcome! Let&apos;s set up your store</h2>
            <p className="text-sm text-stone-600 mt-1">
              Complete your profile, payouts and shipping in four quick steps so you can start selling.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-800"
          >
            Complete your profile
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
        </div>
      )}

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
      {/* TrendChart owns its own /admin/dashboard/revenue query and a 7d/30d/90d
          range picker, so we render it unconditionally — it shows its own
          loading and error states. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <TrendChart />
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
