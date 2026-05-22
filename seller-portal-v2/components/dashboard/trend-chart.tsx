'use client';

import { Card } from '@/components/primitives/card';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';

interface TrendChartProps {
  labels: string[];
  revenue: number[];
  profit: number[];
}

export function TrendChart({ labels, revenue, profit }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...revenue) * 1.15;
  const width = 600;
  const height = 180;
  const padX = 30;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xFor = (i: number) => padX + (i / (labels.length - 1)) * innerW;
  const yFor = (v: number) => padY + innerH - (v / max) * innerH;

  const revPath = revenue.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
  const profitPath = profit.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
  const revAreaPath = `${revPath} L ${xFor(labels.length - 1)} ${padY + innerH} L ${xFor(0)} ${padY + innerH} Z`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-medium text-stone-900">Revenue & profit trend</h2>
          <p className="text-xs text-stone-500 mt-0.5">Last 7 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
            <span className="text-stone-600">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
            <span className="text-stone-600">Profit</span>
          </div>
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
          {/* Grid */}
          {[0.25, 0.5, 0.75, 1].map((t, i) => (
            <line
              key={i}
              x1={padX} x2={width - padX}
              y1={padY + innerH * (1 - t)} y2={padY + innerH * (1 - t)}
              stroke="#f5f5f4" strokeWidth="1"
            />
          ))}
          {/* Revenue area */}
          <path d={revAreaPath} fill="url(#revGradient)" opacity="0.4" />
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#047857" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Revenue line */}
          <path d={revPath} fill="none" stroke="#047857" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* Profit line */}
          <path d={profitPath} fill="none" stroke="#78716c" strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" />

          {/* Hover dots & labels */}
          {labels.map((label, i) => (
            <g key={i}>
              <rect
                x={xFor(i) - 25} y={padY}
                width="50" height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              />
              {hover === i && (
                <>
                  <line x1={xFor(i)} x2={xFor(i)} y1={padY} y2={padY + innerH} stroke="#d6d3d1" strokeWidth="1" />
                  <circle cx={xFor(i)} cy={yFor(revenue[i])} r="4" fill="#047857" stroke="white" strokeWidth="2" />
                  <circle cx={xFor(i)} cy={yFor(profit[i])} r="3" fill="#78716c" stroke="white" strokeWidth="2" />
                </>
              )}
              <text x={xFor(i)} y={height - 4} textAnchor="middle" fontSize="10" fill="#a8a29e">{label}</text>
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full bg-stone-900 text-white text-xs px-3 py-2 rounded-md shadow-lg pointer-events-none"
            style={{ left: `${(xFor(hover) / width) * 100}%`, top: `${(yFor(revenue[hover]) / height) * 100}%` }}
          >
            <div className="font-medium mb-0.5">{labels[hover]}</div>
            <div className="text-stone-200">Revenue · {formatCurrency(revenue[hover])}</div>
            <div className="text-stone-400">Profit · {formatCurrency(profit[hover])}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
