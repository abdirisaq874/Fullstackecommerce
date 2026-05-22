'use client';

import { Search, Bell, Globe } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { setCommandPaletteOpen, setNotificationsPanelOpen } from '@/lib/api/ui-slice';
import { useListNotificationsQuery } from '@/lib/api';
import { useHotkey } from '@/lib/hooks/use-hotkey';

export function Topbar() {
  const dispatch = useAppDispatch();
  const notifPanelOpen = useAppSelector(s => s.ui.notificationsPanelOpen);
  const { data: notifications } = useListNotificationsQuery();
  const unread = notifications?.filter(n => !n.read).length ?? 0;

  useHotkey('cmd+k', (e) => { e.preventDefault(); dispatch(setCommandPaletteOpen(true)); });

  return (
    <header className="h-14 bg-white border-b border-stone-200 flex items-center justify-between px-6 shrink-0 no-print">
      <button
        onClick={() => dispatch(setCommandPaletteOpen(true))}
        className="flex items-center gap-2 flex-1 max-w-md px-2 py-1.5 -mx-2 rounded-md hover:bg-stone-50 transition-colors group"
      >
        <Search className="w-4 h-4 text-stone-400 shrink-0" strokeWidth={2} />
        <span className="text-sm text-stone-400 group-hover:text-stone-500 flex-1 text-left">
          Search orders, products, customers…
        </span>
        <kbd className="hidden sm:inline-block text-2xs text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 font-sans group-hover:border-stone-300">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <button className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 px-2.5 py-1.5 rounded-md hover:bg-stone-50 transition-colors">
          <Globe className="w-3.5 h-3.5" strokeWidth={2} />
          USD
        </button>
        <button
          onClick={() => dispatch(setNotificationsPanelOpen(!notifPanelOpen))}
          className="text-stone-500 hover:text-stone-900 p-2 rounded-md hover:bg-stone-50 transition-colors relative"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        >
          <Bell className="w-4 h-4" strokeWidth={2} />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white" />}
        </button>
      </div>
    </header>
  );
}
