import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

type Trend = 'up' | 'down' | 'neutral';

const trendStyles: Record<Trend, string> = {
  up:      'text-brand-700',
  down:    'text-red-600',
  neutral: 'text-stone-500',
};

const trendIcons: Record<Trend, LucideIcon> = {
  up: TrendingUp, down: TrendingDown, neutral: Minus,
};

export function MetricCard({
  label,
  value,
  delta,
  trend = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: Trend;
  hint?: string;
}) {
  const Icon = trendIcons[trend];
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-5 hover:border-stone-300 transition-colors">
      <div className="text-xs text-stone-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="font-serif text-4xl text-stone-900 mt-2 leading-none tabular-nums">{value}</div>
      {delta && (
        <div className={clsx('text-xs mt-3 flex items-center gap-1', trendStyles[trend])}>
          <Icon className="w-3 h-3" strokeWidth={2.5} />
          <span>{delta}</span>
        </div>
      )}
      {hint && !delta && <div className="text-xs text-stone-500 mt-3">{hint}</div>}
    </div>
  );
}
