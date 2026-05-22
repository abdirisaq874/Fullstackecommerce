'use client';

import Link from 'next/link';
import { AlertCircle, Eye, TrendingUp, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import type { ActionItem } from '@/lib/types';

const columns = [
  { key: 'fix',   title: 'Fix',   subtitle: 'Hurting you now',     Icon: AlertCircle, color: 'red',   bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-200' },
  { key: 'watch', title: 'Watch', subtitle: 'Trending wrong',      Icon: Eye,         color: 'amber', bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200' },
  { key: 'scale', title: 'Scale', subtitle: 'Working — push more', Icon: TrendingUp,  color: 'brand', bg: 'bg-brand-50',  text: 'text-brand-700',  ring: 'ring-brand-200' },
] as const;

export function ActionBoard({
  fix, watch, scale,
}: {
  fix: ActionItem[]; watch: ActionItem[]; scale: ActionItem[];
}) {
  const data = { fix, watch, scale };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {columns.map(col => (
        <div key={col.key} className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={clsx('w-7 h-7 rounded-md grid place-items-center', col.bg)}>
                <col.Icon className={clsx('w-3.5 h-3.5', col.text)} strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-medium text-stone-900">{col.title}</div>
                <div className="text-2xs text-stone-500">{col.subtitle}</div>
              </div>
            </div>
            <span className={clsx('text-2xs font-medium px-1.5 py-0.5 rounded ring-1 ring-inset', col.bg, col.text, col.ring)}>
              {data[col.key].length}
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {data[col.key].length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-stone-500">
                Nothing to {col.title.toLowerCase()} right now
              </div>
            ) : (
              data[col.key].map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group block px-4 py-3 hover:bg-stone-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-medium text-stone-900 leading-snug">{item.title}</div>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 shrink-0 mt-0.5" />
                  </div>
                  <div className="text-xs text-stone-500 leading-relaxed">{item.detail}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
