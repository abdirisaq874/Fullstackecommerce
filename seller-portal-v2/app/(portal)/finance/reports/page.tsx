'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Money } from '@/components/shared/format';
import { useListOrdersQuery, useListProductsQuery } from '@/lib/api';
import { catName, countryFlag, formatCurrency } from '@/lib/utils';
import clsx from 'clsx';

export default function FinanceReportsPage() {
  const router = useRouter();
  const { data: orders = [] } = useListOrdersQuery();
  // Products are scoped to the active store server-side (/products/mine).
  const { data: products = [] } = useListProductsQuery();

  // ─── Revenue by country ───
  const byCountry = useMemo(() => {
    const map = new Map<string, { country: string; orders: number; revenue: number }>();
    for (const o of orders) {
      const c = o.destination.split(',')[1]?.trim() || 'Other';
      const existing = map.get(c) ?? { country: c, orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += o.total;
      map.set(c, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);
  const countryTotal = byCountry.reduce((s, c) => s + c.revenue, 0);

  // ─── Revenue by category ───
  const byCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; orders: number; revenue: number }>();
    for (const o of orders) {
      for (const item of o.itemsList) {
        const product = products.find(p => p.id === item.productId);
        const cat = product?.categoryId ?? 'unknown';
        const existing = map.get(cat) ?? { categoryId: cat, orders: 0, revenue: 0 };
        existing.orders += item.quantity;
        existing.revenue += item.price * item.quantity;
        map.set(cat, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders, products]);
  const categoryTotal = byCategory.reduce((s, c) => s + c.revenue, 0);

  // ─── Revenue by channel (faux from payment method) ───
  const byChannel = useMemo(() => {
    const map = new Map<string, { channel: string; orders: number; revenue: number }>();
    for (const o of orders) {
      const ch = o.paymentMethod.startsWith('Stripe') ? 'Stripe (international cards)'
              : o.paymentMethod.startsWith('Flutterwave') ? 'Flutterwave (Africa)'
              : 'Other';
      const existing = map.get(ch) ?? { channel: ch, orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += o.total;
      map.set(ch, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);
  const channelTotal = byChannel.reduce((s, c) => s + c.revenue, 0);

  // ─── Customer cohort table (faux retention) ───
  const cohorts = [
    { month: 'Feb 2026', size: 24, retained: [24, 12, 7,  4] },
    { month: 'Mar 2026', size: 38, retained: [38, 19, 9,  null] },
    { month: 'Apr 2026', size: 52, retained: [52, 24, null, null] },
    { month: 'May 2026', size: 47, retained: [47, null, null, null] },
  ];

  return (
    <>
      <button onClick={() => router.push('/finance')} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to finance
      </button>

      <PageHeader
        title="Reports"
        subtitle="Revenue breakdowns and customer retention"
        actions={<Button><Download className="w-3.5 h-3.5" /> Export PDF</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By country */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by destination</CardTitle>
            <Badge>{byCountry.length} markets</Badge>
          </CardHeader>
          <div className="divide-y divide-stone-100">
            {byCountry.map(c => {
              const pct = countryTotal > 0 ? (c.revenue / countryTotal) * 100 : 0;
              return (
                <div key={c.country} className="px-5 py-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-stone-900">{countryFlag(c.country.length > 2 ? c.country : `, ${c.country}`)} {c.country}</span>
                    <span className="font-medium tabular-nums"><Money value={c.revenue} /></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
                    <span className="tabular-nums w-16 text-right">{c.orders} orders</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* By category */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by category</CardTitle>
            <Badge>{byCategory.length} categories</Badge>
          </CardHeader>
          <div className="divide-y divide-stone-100">
            {byCategory.map(c => {
              const pct = categoryTotal > 0 ? (c.revenue / categoryTotal) * 100 : 0;
              return (
                <div key={c.categoryId} className="px-5 py-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-stone-900">{catName(c.categoryId)}</span>
                    <span className="font-medium tabular-nums"><Money value={c.revenue} /></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
                    <span className="tabular-nums w-16 text-right">{c.orders} units</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* By channel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Revenue by payment channel</CardTitle>
        </CardHeader>
        <div className="divide-y divide-stone-100">
          {byChannel.map(c => {
            const pct = channelTotal > 0 ? (c.revenue / channelTotal) * 100 : 0;
            return (
              <div key={c.channel} className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-3 px-5 py-3 text-sm">
                <span className="text-stone-900">{c.channel}</span>
                <span className="text-stone-500 text-xs tabular-nums">{c.orders} orders</span>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-stone-500 text-xs tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
                <span className="font-medium tabular-nums w-20 text-right"><Money value={c.revenue} /></span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Customer retention cohort */}
      <Card>
        <CardHeader>
          <CardTitle>Customer retention by cohort</CardTitle>
          <span className="text-xs text-stone-500">% of buyers who ordered again in subsequent months</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50/60 border-b border-stone-200">
                <th className="text-left px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Cohort</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Size</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Month 0</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Month 1</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Month 2</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Month 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cohorts.map(c => (
                <tr key={c.month}>
                  <td className="px-5 py-3 text-stone-900 font-medium">{c.month}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c.size}</td>
                  {c.retained.map((v, i) => (
                    <td key={i} className="px-5 py-3 text-right">
                      {v == null
                        ? <span className="text-stone-300">—</span>
                        : (
                          <div className="inline-block">
                            <span className="tabular-nums text-stone-900">{v}</span>
                            <span className="text-2xs text-stone-500 ml-1">({Math.round((v / c.size) * 100)}%)</span>
                          </div>
                        )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
