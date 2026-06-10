'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  ComposedChart,
} from 'recharts';
import clsx from 'clsx';
import { Card } from '@/components/primitives/card';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { formatCurrency } from '@/lib/utils';
import { useGetRevenueQuery, type RevenuePoint } from '@/lib/api';

type Range = 7 | 30 | 90;

const RANGES: { label: string; value: Range }[] = [
  { label: '7d',  value: 7  },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

// Forest-green palette (Tailwind `brand` scale in tailwind.config.ts).
const LINE_COLOR     = '#047857'; // brand-700
const AREA_TOP       = '#10b981'; // brand-500
const AREA_BOTTOM    = '#ecfdf5'; // brand-50
const GRID_COLOR     = '#f5f5f4'; // stone-100
const AXIS_LABEL     = '#a8a29e'; // stone-400

// Format a 'YYYY-MM-DD' date as 'MMM DD' for the X axis ticks.
function formatTickDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' });
}

// Format a 'YYYY-MM-DD' date as 'Mon, MMM DD YYYY' for the tooltip header.
function formatTooltipDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC',
  });
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: RevenuePoint }>;
}

function RevenueTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-md shadow-lg pointer-events-none">
      <div className="font-medium mb-0.5">{formatTooltipDate(point.date)}</div>
      <div className="text-stone-200">Revenue · {formatCurrency(point.revenue)}</div>
      {typeof point.orders === 'number' && (
        <div className="text-stone-400">Orders · {point.orders}</div>
      )}
    </div>
  );
}

export function TrendChart() {
  const [range, setRange] = useState<Range>(30);
  const { data, isLoading, isError, refetch } = useGetRevenueQuery({ days: range });

  // Recharts handles empty arrays gracefully but the axes look nicer if we
  // memoize the sorted series.
  const series = useMemo<RevenuePoint[]>(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-medium text-stone-900">Revenue trend</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Last {range} days
          </p>
        </div>
        <div className="inline-flex items-center rounded-md border border-stone-200 bg-white p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                range === r.value
                  ? 'bg-brand-700 text-white'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        {isLoading ? (
          <CardSkeleton height={240} />
        ) : isError ? (
          <ErrorState onRetry={refetch} message="We couldn’t load revenue data." />
        ) : series.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-stone-500">
            No revenue in the selected range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series}
              margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
            >
              <defs>
                <linearGradient id="revAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={AREA_TOP}    stopOpacity={0.35} />
                  <stop offset="100%" stopColor={AREA_BOTTOM} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatTickDate}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                tick={{ fill: AXIS_LABEL, fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(Number(v))}
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS_LABEL, fontSize: 11 }}
                width={72}
              />
              <Tooltip
                content={<RevenueTooltip />}
                cursor={{ stroke: '#d6d3d1', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="none"
                fill="url(#revAreaGradient)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={LINE_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'white', strokeWidth: 2, fill: LINE_COLOR }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
