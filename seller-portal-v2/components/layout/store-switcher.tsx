'use client';

import { useState, useRef, useEffect } from 'react';
import { Store as StoreIcon, ChevronsUpDown, Plus, Check } from 'lucide-react';
import clsx from 'clsx';
import { useListMyStoresQuery, useCreateStoreMutation } from '@/lib/api/stores-api';
import { getActiveStoreId, setActiveStoreId, baseApi } from '@/lib/api/base-api';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { selectCurrentUser } from '@/lib/store/auth-slice';
import { useToast } from '@/lib/hooks/use-toast';

/**
 * Store switcher in the sidebar footer. Lets a seller pick which of their stores
 * they're acting as (persisted to localStorage → sent as X-Store-Id on every
 * request) and create new ones. Switching resets the RTK Query cache so all
 * store-scoped data refetches for the newly-active store.
 */
export function StoreSwitcher() {
  const { data: stores = [] } = useListMyStoresQuery();
  const [createStore, { isLoading: creating }] = useCreateStoreMutation();
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Resolve the active store: stored → default (store._id === user._id) → first.
  useEffect(() => {
    if (!stores.length) return;
    const stored = getActiveStoreId();
    let id = stored && stores.some((s) => s._id === stored) ? stored : null;
    if (!id) {
      id = stores.find((s) => s._id === user?._id)?._id ?? stores[0]._id;
      setActiveStoreId(id);
    }
    setActiveId(id);
  }, [stores, user?._id]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const active = stores.find((s) => s._id === activeId);

  const switchTo = (id: string) => {
    setOpen(false);
    if (id === activeId) return;
    setActiveStoreId(id);
    setActiveId(id);
    dispatch(baseApi.util.resetApiState()); // refetch all store-scoped data
  };

  const onCreate = async () => {
    const displayName = name.trim();
    if (displayName.length < 2) return;
    try {
      const s = await createStore({ displayName }).unwrap();
      setActiveStoreId(s._id);
      setActiveId(s._id);
      setName('');
      setShowCreate(false);
      setOpen(false);
      dispatch(baseApi.util.resetApiState());
      toast.success(`Store “${s.displayName}” created`);
    } catch (e) {
      toast.error((e as { data?: { message?: string } })?.data?.message || 'Could not create store');
    }
  };

  if (!stores.length) return null;

  return (
    <div ref={ref} className="relative shrink-0 border-t border-stone-200 dark:border-forest-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-md bg-brand-100 dark:bg-brand-900 grid place-items-center text-brand-800 dark:text-brand-100 shrink-0">
          <StoreIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
            {active?.displayName ?? 'Select store'}
          </div>
          <div className="text-xs text-stone-500 dark:text-stone-400 truncate capitalize">
            {active?.myRole ?? ''}
            {stores.length > 1 ? ` · ${stores.length} stores` : ''}
          </div>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 z-50 max-h-80 overflow-auto rounded-lg border border-stone-200 dark:border-forest-800 bg-white dark:bg-forest-950 shadow-lg py-1">
          {stores.map((s) => (
            <button
              key={s._id}
              type="button"
              onClick={() => switchTo(s._id)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-forest-900 text-left text-sm"
            >
              <span className="flex-1 min-w-0 truncate text-stone-900 dark:text-stone-100">
                {s.displayName}
                {s.status === 'archived' && <span className="text-xs text-stone-400"> (archived)</span>}
              </span>
              <span className="text-xs text-stone-400 capitalize">{s.myRole}</span>
              {s._id === activeId && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
            </button>
          ))}
          <div className="border-t border-stone-100 dark:border-forest-900 mt-1 pt-1">
            {showCreate ? (
              <div className="px-3 py-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                  placeholder="New store name"
                  className={clsx(
                    'flex-1 min-w-0 rounded border border-stone-300 dark:border-forest-800 bg-transparent px-2 py-1 text-sm',
                    'text-stone-900 dark:text-stone-100 focus:border-brand-500 focus:outline-none',
                  )}
                />
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={creating || name.trim().length < 2}
                  className="text-xs font-semibold text-brand-700 dark:text-brand-300 disabled:opacity-50"
                >
                  {creating ? '…' : 'Add'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-forest-900 text-left text-sm text-brand-700 dark:text-brand-300"
              >
                <Plus className="w-4 h-4" /> New store
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
