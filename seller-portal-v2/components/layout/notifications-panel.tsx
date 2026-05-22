'use client';

import Link from 'next/link';
import { Bell, ShoppingCart, Package, MessageCircle, Wallet, AlertCircle, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { setNotificationsPanelOpen } from '@/lib/api/ui-slice';
import { useListNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } from '@/lib/api';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

const categoryIcons: Record<string, typeof Bell> = {
  order: ShoppingCart, stock: Package, message: MessageCircle, payout: Wallet, system: AlertCircle,
};

const categoryColors: Record<string, string> = {
  order: 'bg-sky-50 text-sky-700', stock: 'bg-amber-50 text-amber-700',
  message: 'bg-violet-50 text-violet-700', payout: 'bg-brand-50 text-brand-700',
  system: 'bg-stone-100 text-stone-600',
};

export function NotificationsPanel() {
  const open = useAppSelector(s => s.ui.notificationsPanelOpen);
  const dispatch = useAppDispatch();
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useListNotificationsQuery();
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        dispatch(setNotificationsPanelOpen(false));
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, dispatch]);

  if (!open) return null;

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div ref={ref} className="absolute right-4 top-14 z-40 w-96 bg-white border border-stone-200 rounded-lg shadow-xl animate-in">
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-stone-900">Notifications</div>
          {unread > 0 && <div className="text-xs text-stone-500">{unread} unread</div>}
        </div>
        {unread > 0 && (
          <button onClick={() => markAllRead()} className="text-xs text-brand-700 hover:text-brand-800 font-medium">
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[28rem] overflow-y-auto scrollbar-thin">
        {notifications.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-stone-500">
            <Bell className="w-6 h-6 mx-auto mb-2 text-stone-300" />
            No notifications yet
          </div>
        ) : (
          notifications.map(n => {
            const Icon = categoryIcons[n.category] ?? Bell;
            return (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => {
                  markRead(n.id);
                  dispatch(setNotificationsPanelOpen(false));
                }}
                className={clsx(
                  'flex items-start gap-3 px-4 py-3 border-b border-stone-100 transition-colors',
                  n.read ? 'hover:bg-stone-50' : 'bg-brand-50/30 hover:bg-brand-50/50'
                )}
              >
                <div className={clsx('w-8 h-8 rounded-md grid place-items-center shrink-0', categoryColors[n.category])}>
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className={clsx('text-sm', n.read ? 'text-stone-700' : 'text-stone-900 font-medium')}>{n.title}</div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">{n.body}</div>
                  <div className="text-2xs text-stone-400 mt-1">{n.createdAt}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
