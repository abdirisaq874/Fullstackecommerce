'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Crumb { label: string; href?: string; }

export function PageHeader({
  title, subtitle, actions, breadcrumbs,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-7">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="text-xs text-stone-600 dark:text-stone-300 mb-3 flex items-center gap-1.5 flex-wrap"
        >
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3 text-stone-400 dark:text-stone-500" aria-hidden="true" />}
              {b.href
                ? <Link href={b.href} className="hover:text-stone-900 dark:hover:text-stone-100">{b.label}</Link>
                : <span className="text-stone-700 dark:text-stone-200" aria-current="page">{b.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl text-stone-900 leading-tight">{title}</h1>
          {subtitle && <div className="text-sm text-stone-500 mt-1">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
