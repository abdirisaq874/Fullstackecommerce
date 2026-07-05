'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

const MAX_BAR = 10; // top-level pills in the bar
const MAX_ITEMS = 6; // 3rd-level links per group before "+N more"

/** Desktop mega menu: pill category rail → hover panel (rail + scrollable columns). */
export function MegaMenu({ categories }: { categories: Category[] }) {
  const tops = (categories ?? []).filter(Boolean);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = tops.find((c) => c._id === activeId) ?? tops[0] ?? null;
  const cancelClose = () => closeTimer.current && clearTimeout(closeTimer.current);
  const openWith = (id: string) => { cancelClose(); setActiveId(id); setOpen(true); };
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpen(false), 120); };

  if (!tops.length) return null;

  return (
    <div
      className="relative hidden lg:block"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <nav className="container flex h-12 items-center gap-1.5 overflow-x-auto text-sm font-medium [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Product categories">
        <Link href="/search" className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 font-semibold text-white">All</Link>
        {tops.slice(0, MAX_BAR).map((c) => (
          <Link
            key={c._id}
            href={`/c/${c.slug}`}
            onMouseEnter={() => openWith(c._id)}
            onFocus={() => openWith(c._id)}
            aria-expanded={open && active?._id === c._id}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors',
              open && active?._id === c._id ? 'bg-ink text-white' : 'text-ink/75 hover:bg-muted hover:text-ink',
            )}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {open && active && (
        <div
          className="absolute inset-x-0 top-full z-40 border-t border-line bg-surface shadow-lift animate-fade-up"
          onMouseEnter={cancelClose}
        >
          <div className="container flex gap-6 py-6">
            {/* Department rail */}
            <aside className="w-56 shrink-0 border-r border-line pr-3">
              <ul className="max-h-[62vh] space-y-0.5 overflow-y-auto pr-1">
                {tops.map((c) => (
                  <li key={c._id}>
                    <Link
                      href={`/c/${c.slug}`}
                      onMouseEnter={() => setActiveId(c._id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-2 text-sm',
                        active._id === c._id ? 'bg-muted font-semibold text-brand' : 'text-ink/75 hover:bg-muted',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Subcategories — real grid + vertical scroll (no horizontal overflow) */}
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold tracking-tight">{active.name}</h3>
                <Link href={`/c/${active.slug}`} className="font-mono text-xs font-medium uppercase tracking-widest text-brand hover:underline">
                  View all →
                </Link>
              </div>
              {active.children?.length ? (
                <div className="grid max-h-[58vh] grid-cols-2 gap-x-6 gap-y-5 overflow-y-auto pr-1 xl:grid-cols-4">
                  {active.children.map((group) => (
                    <div key={group._id} className="min-w-0">
                      <Link href={`/c/${group.slug}`} className="mb-1.5 block truncate text-sm font-semibold text-ink hover:text-brand">
                        {group.name}
                      </Link>
                      {group.children?.length ? (
                        <ul className="space-y-1">
                          {group.children.slice(0, MAX_ITEMS).map((leaf) => (
                            <li key={leaf._id}>
                              <Link href={`/c/${leaf.slug}`} className="block truncate text-sm text-muted-fg hover:text-brand">
                                {leaf.name}
                              </Link>
                            </li>
                          ))}
                          {group.children.length > MAX_ITEMS && (
                            <li>
                              <Link href={`/c/${group.slug}`} className="text-sm font-medium text-brand hover:underline">
                                +{group.children.length - MAX_ITEMS} more
                              </Link>
                            </li>
                          )}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-fg">Browse everything in {active.name}.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Mobile: two-level accordion for the drawer. */
export function MobileCategoryNav({
  categories,
  onNavigate,
}: {
  categories: Category[];
  onNavigate: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const tops = (categories ?? []).filter(Boolean);

  return (
    <div>
      {tops.map((c) => (
        <div key={c._id} className="border-b border-line/60">
          <div className="flex items-center">
            <Link href={`/c/${c.slug}`} onClick={onNavigate} className="flex-1 rounded-lg px-3 py-2.5 font-semibold hover:bg-muted">
              {c.name}
            </Link>
            {c.children?.length ? (
              <button
                onClick={() => setOpenId((v) => (v === c._id ? null : c._id))}
                className="focus-ring grid h-9 w-9 place-items-center rounded-lg"
                aria-label={`Toggle ${c.name}`}
                aria-expanded={openId === c._id}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', openId === c._id && 'rotate-180')} />
              </button>
            ) : null}
          </div>
          {openId === c._id && c.children?.length ? (
            <div className="pb-2 pl-4">
              {c.children.map((sub) => (
                <Link
                  key={sub._id}
                  href={`/c/${sub.slug}`}
                  onClick={onNavigate}
                  className="block rounded-lg px-3 py-1.5 text-sm text-muted-fg hover:bg-muted hover:text-ink"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
