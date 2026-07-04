'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/types';

const MAX_BAR = 11; // top-level items shown in the horizontal bar
const MAX_ITEMS = 6; // 3rd-level links per group before "+N more"

/** Desktop mega menu: category bar → hover panel (left rail + column groups). */
export function MegaMenu({ categories }: { categories: Category[] }) {
  const tops = (categories ?? []).filter(Boolean);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = tops.find((c) => c._id === activeId) ?? tops[0] ?? null;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const openWith = (id: string) => {
    cancelClose();
    setActiveId(id);
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  if (!tops.length) return null;

  return (
    <div
      className="relative hidden lg:block"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <nav className="container flex h-11 items-center gap-5 text-sm font-semibold" aria-label="Product categories">
        <Link href="/search" className="text-accent hover:underline">All</Link>
        {tops.slice(0, MAX_BAR).map((c) => (
          <Link
            key={c._id}
            href={`/c/${c.slug}`}
            onMouseEnter={() => openWith(c._id)}
            onFocus={() => openWith(c._id)}
            aria-expanded={open && active?._id === c._id}
            className={cn(
              'flex h-full items-center border-b-2 transition-colors',
              open && active?._id === c._id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink/80 hover:text-brand',
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
            {/* Left rail — every department */}
            <aside className="w-56 shrink-0 border-r border-line pr-3">
              <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
                {tops.map((c) => (
                  <li key={c._id}>
                    <Link
                      href={`/c/${c.slug}`}
                      onMouseEnter={() => setActiveId(c._id)}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                        active._id === c._id ? 'bg-muted font-bold text-brand' : 'text-ink/80 hover:bg-muted',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Active department's subcategories */}
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">{active.name}</h3>
                <Link href={`/c/${active.slug}`} className="text-sm font-semibold text-accent hover:underline">
                  View all →
                </Link>
              </div>
              {active.children?.length ? (
                <div className="columns-2 [column-gap:1.5rem] xl:columns-4">
                  {active.children.map((group) => (
                    <div key={group._id} className="mb-5 break-inside-avoid">
                      <Link href={`/c/${group.slug}`} className="mb-1.5 block text-sm font-bold text-ink hover:text-brand">
                        {group.name}
                      </Link>
                      {group.children?.length ? (
                        <ul className="space-y-1">
                          {group.children.slice(0, MAX_ITEMS).map((leaf) => (
                            <li key={leaf._id}>
                              <Link href={`/c/${leaf.slug}`} className="text-sm text-muted-fg hover:text-brand">
                                {leaf.name}
                              </Link>
                            </li>
                          ))}
                          {group.children.length > MAX_ITEMS && (
                            <li>
                              <Link href={`/c/${group.slug}`} className="text-sm font-semibold text-accent hover:underline">
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
            <Link
              href={`/c/${c.slug}`}
              onClick={onNavigate}
              className="flex-1 rounded-lg px-3 py-2.5 font-semibold hover:bg-muted"
            >
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
