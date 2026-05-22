'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, ShoppingCart, Layers, MessageCircle, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/primitives/modal';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { setCommandPaletteOpen } from '@/lib/api/ui-slice';
import { useListProductsQuery, useListOrdersQuery, useListInventoryQuery, useListMessagesQuery } from '@/lib/api';
import clsx from 'clsx';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: typeof Search;
  group: string;
}

export function CommandPalette() {
  const open = useAppSelector(s => s.ui.commandPaletteOpen);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const { data: products = [] }  = useListProductsQuery();
  const { data: orders = [] }    = useListOrdersQuery();
  const { data: inventory = [] } = useListInventoryQuery();
  const { data: messages = [] }  = useListMessagesQuery();

  const items = useMemo<PaletteItem[]>(() => {
    const all: PaletteItem[] = [];
    products.forEach(p => all.push({
      id: `p-${p.id}`, label: p.name, hint: `${p.sku} · ${p.status}`,
      href: `/products/${p.id}/edit`, icon: Package, group: 'Products',
    }));
    orders.forEach(o => all.push({
      id: `o-${o.id}`, label: `Order #${o.id}`, hint: `${o.customer} · ${o.status}`,
      href: `/orders/${o.id}`, icon: ShoppingCart, group: 'Orders',
    }));
    inventory.forEach(r => all.push({
      id: `i-${r.sku}`, label: r.sku, hint: `${r.productName} · ${r.available} available`,
      href: `/inventory/${r.sku}`, icon: Layers, group: 'Inventory',
    }));
    messages.forEach(m => all.push({
      id: `m-${m.id}`, label: m.subject, hint: `from ${m.customer}`,
      href: `/messages/${m.id}`, icon: MessageCircle, group: 'Messages',
    }));
    return all;
  }, [products, orders, inventory, messages]);

  const filtered = useMemo(() => {
    if (!query) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [items, query]);

  useEffect(() => { setActiveIdx(0); }, [query, open]);

  const close = () => { dispatch(setCommandPaletteOpen(false)); setQuery(''); };

  const go = (item: PaletteItem) => { router.push(item.href); close(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && filtered[activeIdx]) { e.preventDefault(); go(filtered[activeIdx]); }
  };

  // Group filtered items
  const groups = filtered.reduce<Record<string, PaletteItem[]>>((acc, it) => {
    (acc[it.group] ??= []).push(it);
    return acc;
  }, {});

  return (
    <Modal open={open} onClose={close} size="md">
      <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-3">
        <Search className="w-4 h-4 text-stone-400" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search products, orders, inventory, messages…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-stone-400"
        />
        <kbd className="text-2xs text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">esc</kbd>
      </div>
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            No results for "{query}"
          </div>
        ) : (
          Object.entries(groups).map(([groupName, list]) => (
            <div key={groupName} className="py-2">
              <div className="px-4 py-1 text-2xs uppercase tracking-wide text-stone-400 font-medium">{groupName}</div>
              {list.map(item => {
                const idx = filtered.indexOf(item);
                const active = idx === activeIdx;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => go(item)}
                    className={clsx(
                      'w-full px-4 py-2 flex items-center gap-3 text-left transition-colors',
                      active ? 'bg-brand-50' : 'hover:bg-stone-50'
                    )}
                  >
                    <item.icon className={clsx('w-4 h-4 shrink-0', active ? 'text-brand-700' : 'text-stone-400')} />
                    <div className="flex-1 min-w-0">
                      <div className={clsx('text-sm truncate', active ? 'text-brand-900 font-medium' : 'text-stone-900')}>{item.label}</div>
                      {item.hint && <div className="text-xs text-stone-500 truncate">{item.hint}</div>}
                    </div>
                    {active && <ArrowRight className="w-3.5 h-3.5 text-brand-700" />}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-stone-200 bg-stone-50/40 flex items-center gap-4 text-2xs text-stone-500">
        <span><kbd className="border border-stone-200 rounded px-1 py-0.5">↑</kbd> <kbd className="border border-stone-200 rounded px-1 py-0.5">↓</kbd> navigate</span>
        <span><kbd className="border border-stone-200 rounded px-1 py-0.5">↵</kbd> open</span>
        <span><kbd className="border border-stone-200 rounded px-1 py-0.5">esc</kbd> close</span>
      </div>
    </Modal>
  );
}
