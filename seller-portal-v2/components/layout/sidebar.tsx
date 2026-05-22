'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, Users,
  Tag, Wallet, Truck, Settings, MessageCircle, RotateCcw, ChevronsUpDown,
} from 'lucide-react';
import { useListOrdersQuery, useListMessagesQuery, useListReturnsQuery, useListInventoryQuery } from '@/lib/api';

const nav = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/products',   label: 'Products',   icon: Package },
  { href: '/orders',     label: 'Orders',     icon: ShoppingCart, kind: 'orders'   as const },
  { href: '/inventory',  label: 'Inventory',  icon: Layers,       kind: 'stock'    as const },
  { href: '/returns',    label: 'Returns',    icon: RotateCcw,    kind: 'returns'  as const },
  { href: '/messages',   label: 'Messages',   icon: MessageCircle,kind: 'messages' as const },
  { href: '/customers',  label: 'Customers',  icon: Users },
  { href: '/marketing',  label: 'Marketing',  icon: Tag },
  { href: '/finance',    label: 'Finance',    icon: Wallet },
  { href: '/shipping',   label: 'Shipping',   icon: Truck },
  { href: '/settings',   label: 'Settings',   icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: orders }    = useListOrdersQuery();
  const { data: messages }  = useListMessagesQuery();
  const { data: returns }   = useListReturnsQuery();
  const { data: inventory } = useListInventoryQuery();

  const counts = {
    orders:   orders?.filter(o => ['new', 'confirmed', 'processing', 'picked', 'packed'].includes(o.status)).length ?? 0,
    messages: messages?.filter(m => m.status === 'unread').length ?? 0,
    returns:  returns?.filter(r => ['requested', 'received', 'inspected'].includes(r.status)).length ?? 0,
    stock:    inventory?.filter(r => r.available <= r.reorderThreshold).length ?? 0,
  };

  return (
    <aside className="w-60 bg-white border-r border-stone-200 flex flex-col shrink-0 no-print">
      <div className="px-5 pt-6 pb-5 border-b border-stone-200">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-brand-700 text-white grid place-items-center">
            <span className="font-serif text-lg leading-none translate-y-[1px]">G</span>
          </div>
          <div>
            <div className="font-serif text-xl text-stone-900 leading-none">Gaarsii</div>
            <div className="text-2xs text-stone-500 mt-1 tracking-wide uppercase">Seller portal</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map(({ href, label, icon: Icon, kind }) => {
          const isActive = pathname === href || pathname?.startsWith(href + '/');
          const badge = kind ? counts[kind] : 0;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-800 font-medium'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              )}
            >
              <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-brand-700' : 'text-stone-400 group-hover:text-stone-600')} strokeWidth={2} />
              <span className="flex-1">{label}</span>
              {kind && badge > 0 && (
                <span className={clsx(
                  'text-2xs font-medium px-1.5 py-0.5 rounded',
                  kind === 'stock' && badge > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-100 text-stone-600'
                )}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button className="px-4 py-3 border-t border-stone-200 hover:bg-stone-50 transition-colors text-left flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-stone-200 grid place-items-center text-xs font-medium text-stone-700 shrink-0">AT</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-stone-900 truncate">Aysel Tekstil</div>
          <div className="text-xs text-stone-500 truncate">Istanbul · 2 stores</div>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-stone-400 shrink-0" strokeWidth={2} />
      </button>
    </aside>
  );
}
