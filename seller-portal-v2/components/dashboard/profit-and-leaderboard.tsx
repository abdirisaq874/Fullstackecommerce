'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/primitives/card';
import { Money } from '@/components/shared/format';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import type { ProductLeaderboardEntry } from '@/lib/types';

interface ProfitTruthProps {
  grossSales: number;
  costs: {
    productCost: number;
    platformFee: number;
    paymentFee: number;
    shippingCost: number;
    refundCost: number;
  };
  profit: number;
}

export function ProfitTruthCard({ grossSales, costs, profit }: ProfitTruthProps) {
  const totalCosts = costs.productCost + costs.platformFee + costs.paymentFee + costs.shippingCost + costs.refundCost;
  const margin = grossSales > 0 ? (profit / grossSales) * 100 : 0;
  const breakdown = [
    { label: 'Product cost',    value: costs.productCost,  pct: (costs.productCost  / grossSales) * 100, color: 'bg-stone-600' },
    { label: 'Platform fee',    value: costs.platformFee,  pct: (costs.platformFee  / grossSales) * 100, color: 'bg-stone-400' },
    { label: 'Payment fee',     value: costs.paymentFee,   pct: (costs.paymentFee   / grossSales) * 100, color: 'bg-stone-300' },
    { label: 'Shipping cost',   value: costs.shippingCost, pct: (costs.shippingCost / grossSales) * 100, color: 'bg-amber-400' },
    { label: 'Refunds',         value: costs.refundCost,   pct: (costs.refundCost   / grossSales) * 100, color: 'bg-red-400'   },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-stone-900">Profit truth</h2>
        <p className="text-xs text-stone-500 mt-0.5">What's actually left after costs</p>
      </div>

      <div className="bg-stone-50/60 rounded-lg p-3 mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xs text-stone-500 uppercase tracking-wide">Gross</div>
            <div className="font-serif text-xl text-stone-900 mt-1 tabular-nums"><Money value={grossSales} /></div>
          </div>
          <div className="border-l border-stone-200">
            <div className="text-2xs text-stone-500 uppercase tracking-wide">Costs</div>
            <div className="font-serif text-xl text-stone-600 mt-1 tabular-nums">−<Money value={totalCosts} /></div>
          </div>
          <div className="border-l border-stone-200">
            <div className="text-2xs text-stone-500 uppercase tracking-wide">Profit</div>
            <div className="font-serif text-xl text-brand-700 mt-1 tabular-nums"><Money value={profit} /></div>
            <div className="text-2xs text-brand-600 mt-0.5 tabular-nums">{margin.toFixed(1)}% margin</div>
          </div>
        </div>
      </div>

      {/* Stacked horizontal bar showing cost composition */}
      <div className="flex h-2 rounded-full overflow-hidden bg-stone-100 mb-3">
        {breakdown.map(b => (
          <div key={b.label} className={clsx('h-full', b.color)} style={{ width: `${b.pct}%` }} title={`${b.label}: ${b.pct.toFixed(1)}%`} />
        ))}
      </div>

      <div className="space-y-1.5">
        {breakdown.map(b => (
          <div key={b.label} className="flex items-center gap-2 text-xs">
            <span className={clsx('w-2 h-2 rounded-sm', b.color)} />
            <span className="text-stone-600 flex-1">{b.label}</span>
            <span className="text-stone-500 tabular-nums">{b.pct.toFixed(1)}%</span>
            <span className="text-stone-900 tabular-nums w-16 text-right"><Money value={b.value} /></span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ProductsLeaderboard({
  title, subtitle, items, direction,
}: {
  title: string;
  subtitle: string;
  items: ProductLeaderboardEntry[];
  direction: 'up' | 'down';
}) {
  const Icon = direction === 'up' ? TrendingUp : TrendingDown;
  const accent = direction === 'up' ? 'text-brand-700' : 'text-red-600';
  return (
    <Card>
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={clsx('w-4 h-4', accent)} strokeWidth={2} />
            <h2 className="text-sm font-medium text-stone-900">{title}</h2>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-stone-100">
        {items.map(item => (
          <Link
            key={item.productId}
            href={`/products/${item.productId}/analytics`}
            className="group flex items-center gap-3 px-5 py-3 hover:bg-stone-50/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-md overflow-hidden bg-stone-100 grid place-items-center shrink-0 ring-1 ring-stone-200">
              {item.imageUrl
                ? <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                : <span className="font-serif text-base text-stone-500">{item.initial}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-stone-900 truncate">{item.name}</div>
              <div className="text-xs text-stone-500"><Money value={item.revenue} /> · {item.units} units</div>
            </div>
            <div className={clsx('text-xs font-medium tabular-nums', accent)}>
              {item.changePct > 0 ? '+' : ''}{item.changePct}%
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500" />
          </Link>
        ))}
      </div>
    </Card>
  );
}
