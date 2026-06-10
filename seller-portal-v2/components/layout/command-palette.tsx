'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, ShoppingCart, MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { Modal } from '@/components/primitives/modal';
import { Alert } from '@/components/primitives/alert';
import { Badge } from '@/components/primitives/badge';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { setCommandPaletteOpen } from '@/lib/api/ui-slice';
import { useLazySearchQuery } from '@/lib/api/search-api';
import type { SearchResult, SearchEntityType } from '@/lib/api/search-api';
import type { BadgeVariant } from '@/lib/utils';

const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 20;

// Per-entity icon + badge styling so the result row can render any type
// with a single component.
const TYPE_META: Record<SearchEntityType, { icon: typeof Search; label: string; variant: BadgeVariant; group: string }> = {
  product: { icon: Package, label: 'Product', variant: 'success', group: 'Products' },
  order: { icon: ShoppingCart, label: 'Order', variant: 'info', group: 'Orders' },
  message: { icon: MessageCircle, label: 'Message', variant: 'neutral', group: 'Messages' },
};

export function CommandPalette() {
  const open = useAppSelector((s) => s.ui.commandPaletteOpen);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  // Lazy trigger so we only hit the backend after the debounce elapses,
  // not on every keystroke. `lastData` keeps the previous results visible
  // while a new request is in flight (smoother UX than a flicker to empty).
  const [trigger, { data, isFetching, isError, error }] = useLazySearchQuery();

  // Debounce: wait DEBOUNCE_MS after the user stops typing before firing.
  // Empty queries reset to an empty result set without hitting the network.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const trimmed = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmed) return;
    debounceRef.current = setTimeout(() => {
      trigger({ q: trimmed, limit: SEARCH_LIMIT }, /* preferCacheValue */ true);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, trigger]);

  // Reset highlighted row whenever the query or palette open state changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const trimmed = query.trim();
  const results = useMemo<SearchResult[]>(
    () => (trimmed ? data?.results ?? [] : []),
    [data, trimmed],
  );

  // Group results by entity type for section headings while preserving the
  // server-side ordering (products → orders → messages, since the backend
  // returns them concatenated in that order).
  const groups = useMemo(() => {
    const byType: Record<SearchEntityType, SearchResult[]> = { product: [], order: [], message: [] };
    for (const r of results) byType[r.type].push(r);
    return (['product', 'order', 'message'] as SearchEntityType[])
      .filter((t) => byType[t].length > 0)
      .map((t) => ({ type: t, items: byType[t] }));
  }, [results]);

  const close = () => {
    dispatch(setCommandPaletteOpen(false));
    setQuery('');
  };

  const go = (item: SearchResult) => {
    router.push(item.url);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    }
    if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault();
      go(results[activeIdx]);
    }
  };

  // Derive top-level state for the result body so each branch is explicit:
  // idle (no query) → empty hint, fetching → spinner, error → alert,
  // empty result set → "No results", otherwise → grouped list.
  const showSpinner = isFetching && results.length === 0;
  const showError = !isFetching && isError && trimmed.length > 0;
  const showEmpty = !isFetching && !isError && trimmed.length > 0 && results.length === 0;
  const showIdle = !trimmed;

  // Best-effort error message extraction (FetchBaseQueryError shape varies).
  const errorMessage = (() => {
    if (!isError || !error) return null;
    const e = error as { data?: { message?: string }; error?: string; status?: number | string };
    return e.data?.message ?? e.error ?? `Search failed${e.status ? ` (${e.status})` : ''}`;
  })();

  return (
    <Modal open={open} onClose={close} size="md">
      <div className="px-4 py-3 border-b border-stone-200 dark:border-forest-900 flex items-center gap-3">
        <Search className="w-4 h-4 text-stone-400" aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search products, orders, messages…"
          aria-label="Search"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-stone-400 dark:text-stone-100"
        />
        {isFetching && trimmed && (
          <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin" aria-hidden="true" />
        )}
        <kbd className="text-2xs text-stone-400 border border-stone-200 dark:border-forest-900 rounded px-1.5 py-0.5">esc</kbd>
      </div>

      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {showIdle && (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            Start typing to search products, orders, and messages.
          </div>
        )}

        {showSpinner && (
          <div className="px-6 py-12 flex items-center justify-center gap-2 text-sm text-stone-500">
            <Loader2 className="w-4 h-4 animate-spin text-brand-700" aria-hidden="true" />
            <span>Searching…</span>
          </div>
        )}

        {showError && (
          <div className="px-4 py-4">
            <Alert variant="danger">{errorMessage}</Alert>
          </div>
        )}

        {showEmpty && (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            No results for &ldquo;{trimmed}&rdquo;
          </div>
        )}

        {!showIdle && !showSpinner && !showError && results.length > 0 && (
          groups.map(({ type, items }) => (
            <div key={type} className="py-2">
              <div className="px-4 py-1 text-2xs uppercase tracking-wide text-stone-400 font-medium">
                {TYPE_META[type].group}
              </div>
              {items.map((item) => {
                const idx = results.indexOf(item);
                const active = idx === activeIdx;
                const Icon = TYPE_META[item.type].icon;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => go(item)}
                    className={clsx(
                      'w-full px-4 py-2 flex items-center gap-3 text-left transition-colors',
                      active
                        ? 'bg-brand-50 dark:bg-forest-900/60'
                        : 'hover:bg-stone-50 dark:hover:bg-forest-900/40',
                    )}
                  >
                    <Icon
                      className={clsx(
                        'w-4 h-4 shrink-0',
                        active ? 'text-brand-700 dark:text-brand-300' : 'text-stone-400',
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={TYPE_META[item.type].variant}>
                          {TYPE_META[item.type].label}
                        </Badge>
                        <div
                          className={clsx(
                            'text-sm truncate',
                            active
                              ? 'text-brand-900 dark:text-brand-100 font-medium'
                              : 'text-stone-900 dark:text-stone-100',
                          )}
                        >
                          {item.title}
                        </div>
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {active && (
                      <ArrowRight
                        className="w-3.5 h-3.5 text-brand-700 dark:text-brand-300"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-stone-200 dark:border-forest-900 bg-stone-50/40 dark:bg-forest-950/40 flex items-center gap-4 text-2xs text-stone-500">
        <span>
          <kbd className="border border-stone-200 dark:border-forest-900 rounded px-1 py-0.5">↑</kbd>{' '}
          <kbd className="border border-stone-200 dark:border-forest-900 rounded px-1 py-0.5">↓</kbd> navigate
        </span>
        <span>
          <kbd className="border border-stone-200 dark:border-forest-900 rounded px-1 py-0.5">↵</kbd> open
        </span>
        <span>
          <kbd className="border border-stone-200 dark:border-forest-900 rounded px-1 py-0.5">esc</kbd> close
        </span>
      </div>
    </Modal>
  );
}
