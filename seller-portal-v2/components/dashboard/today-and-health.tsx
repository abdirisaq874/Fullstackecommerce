'use client';

import Link from 'next/link';
import { Package, MessageCircle, Layers, RotateCcw, Star, ArrowRight } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { formatPercent } from '@/lib/utils';
import clsx from 'clsx';

interface TodayActionsProps {
  pendingFulfillment: number;
  lowStockSkus: number;
  unrepliedMessages: number;
  pendingReturns: number;
}

export function TodayActionsCard({
  pendingFulfillment, lowStockSkus, unrepliedMessages, pendingReturns,
}: TodayActionsProps) {
  const items = [
    { label: 'Orders to ship',     count: pendingFulfillment, href: '/orders',    Icon: Package },
    { label: 'Low stock SKUs',     count: lowStockSkus,       href: '/inventory', Icon: Layers },
    { label: 'Messages to reply',  count: unrepliedMessages,  href: '/messages',  Icon: MessageCircle },
    { label: 'Returns to review',  count: pendingReturns,     href: '/returns',   Icon: RotateCcw },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-stone-900">What to do today</h2>
          <p className="text-xs text-stone-500 mt-0.5">Your action queue, fastest to slowest impact</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map(({ label, count, href, Icon }) => (
          <Link
            key={label}
            href={href}
            className="group flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-md hover:bg-stone-50 transition-colors"
          >
            <div className={clsx(
              'w-9 h-9 rounded-md grid place-items-center shrink-0',
              count > 0 ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-400'
            )}>
              <Icon className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-stone-900">{label}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'font-serif text-2xl tabular-nums leading-none',
                count > 0 ? 'text-stone-900' : 'text-stone-300'
              )}>
                {count}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500" />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

interface StoreHealthProps {
  rating: number;
  onTimeShipmentPct: number;
  cancellationRatePct: number;
  returnRatePct: number;
  responseRatePct: number;
}

export function StoreHealthCard(h: StoreHealthProps) {
  // Composite health score (0–100). Each metric weighted equally for simplicity.
  const ratingScore = (h.rating / 5) * 100;
  const onTimeScore = h.onTimeShipmentPct;
  const cancelScore = Math.max(0, 100 - h.cancellationRatePct * 10);
  const returnScore = Math.max(0, 100 - h.returnRatePct * 5);
  const responseScore = h.responseRatePct;
  const overall = (ratingScore + onTimeScore + cancelScore + returnScore + responseScore) / 5;

  const healthLabel = overall >= 90 ? 'Excellent' : overall >= 75 ? 'Healthy' : overall >= 60 ? 'Watch' : 'Action needed';
  const healthColor = overall >= 90 ? 'text-brand-700' : overall >= 75 ? 'text-brand-600' : overall >= 60 ? 'text-amber-600' : 'text-red-600';

  const metrics = [
    { label: 'Rating',           value: h.rating.toFixed(1),                 raw: ratingScore,  icon: <Star className="w-3 h-3 fill-current" /> },
    { label: 'On-time shipment', value: formatPercent(h.onTimeShipmentPct),  raw: onTimeScore },
    { label: 'Response rate',    value: formatPercent(h.responseRatePct),    raw: responseScore },
    { label: 'Return rate',      value: formatPercent(h.returnRatePct),      raw: 100 - h.returnRatePct * 5, inverted: true, rawValue: h.returnRatePct },
    { label: 'Cancellation',     value: formatPercent(h.cancellationRatePct),raw: 100 - h.cancellationRatePct * 10, inverted: true, rawValue: h.cancellationRatePct },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-stone-900">Store health</h2>
          <p className="text-xs text-stone-500 mt-0.5">Combined score across 5 signals</p>
        </div>
        <div className="text-right">
          <div className={clsx('font-serif text-3xl leading-none tabular-nums', healthColor)}>
            {Math.round(overall)}
          </div>
          <div className={clsx('text-2xs font-medium mt-1', healthColor)}>{healthLabel}</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {metrics.map(m => (
          <div key={m.label} className="grid grid-cols-[110px_1fr_50px] items-center gap-3">
            <div className="text-xs text-stone-600 flex items-center gap-1.5">
              {m.icon}{m.label}
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  m.raw >= 90 ? 'bg-brand-600' : m.raw >= 70 ? 'bg-brand-500' : m.raw >= 50 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.max(2, Math.min(100, m.raw))}%` }}
              />
            </div>
            <div className="text-xs text-stone-900 tabular-nums font-medium text-right">{m.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
