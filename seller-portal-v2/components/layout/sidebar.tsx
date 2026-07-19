'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Layers, Users,
  Tag, Wallet, Truck, Settings, MessageCircle, RotateCcw, ChevronsUpDown, X,
} from 'lucide-react';
import { useListOrdersQuery, useListMessagesQuery, useListReturnsQuery, useListInventoryQuery } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { setSidebarOpen } from '@/lib/api/ui-slice';
import { selectCurrentUser } from '@/lib/store/auth-slice';
import { StoreSwitcher } from './store-switcher';
import { UserRole } from '@/lib/types/user';
import type { ComponentType, SVGProps } from 'react';

type NavBadgeKind = 'orders' | 'stock' | 'returns' | 'messages';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  kind?: NavBadgeKind;
  /** When omitted, the item is visible to every authenticated user. */
  roles?: UserRole[];
}

// Roles required to see each link. Items with no `roles` are visible to all
// authenticated users (e.g. Dashboard, Settings). Seller-operations links are
// scoped to seller + admin; admin-only links use `[UserRole.ADMIN]`.
const SELLER_OR_ADMIN: UserRole[] = [UserRole.SELLER, UserRole.ADMIN];

const nav: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/products',   label: 'Products',   icon: Package,                                  roles: SELLER_OR_ADMIN },
  { href: '/orders',     label: 'Orders',     icon: ShoppingCart, kind: 'orders'   as const,  roles: SELLER_OR_ADMIN },
  { href: '/inventory',  label: 'Inventory',  icon: Layers,       kind: 'stock'    as const,  roles: SELLER_OR_ADMIN },
  { href: '/returns',    label: 'Returns',    icon: RotateCcw,    kind: 'returns'  as const,  roles: SELLER_OR_ADMIN },
  { href: '/messages',   label: 'Messages',   icon: MessageCircle,kind: 'messages' as const,  roles: SELLER_OR_ADMIN },
  { href: '/customers',  label: 'Customers',  icon: Users,                                    roles: SELLER_OR_ADMIN },
  { href: '/marketing',  label: 'Marketing',  icon: Tag,                                      roles: SELLER_OR_ADMIN },
  { href: '/finance',    label: 'Finance',    icon: Wallet,                                   roles: SELLER_OR_ADMIN },
  { href: '/shipping',   label: 'Shipping',   icon: Truck,                                    roles: SELLER_OR_ADMIN },
  { href: '/settings',   label: 'Settings',   icon: Settings },
];

/** First letters of first + last name, falling back to the email's first char. */
function getSidebarInitials(firstName?: string, lastName?: string, email?: string): string {
  const initials = `${(firstName ?? '').charAt(0)}${(lastName ?? '').charAt(0)}`.toUpperCase();
  if (initials) return initials;
  if (email) return email.charAt(0).toUpperCase();
  return '·';
}

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector(s => s.ui.sidebarOpen);
  const user = useAppSelector(selectCurrentUser);
  const { data: orders }    = useListOrdersQuery();
  const { data: messages }  = useListMessagesQuery();
  const { data: returns }   = useListReturnsQuery();
  const { data: inventory } = useListInventoryQuery();

  // Close the drawer whenever the route changes — without this the drawer
  // would stay visibly open after navigation on mobile.
  useEffect(() => {
    if (sidebarOpen) dispatch(setSidebarOpen(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape key closes the drawer (mobile only — harmless on lg+).
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(setSidebarOpen(false));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen, dispatch]);

  // Lock body scroll while the mobile drawer is open so the page underneath
  // doesn't scroll behind the overlay.
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);

  // Hide entries whose `roles` allow-list doesn't include the signed-in user's
  // role. Items without `roles` are visible to everyone.
  const visibleItems = nav.filter(
    (i) => !i.roles || (user?.role !== undefined && i.roles.includes(user.role as UserRole)),
  );

  const counts = {
    orders:   orders?.filter(o => ['new', 'confirmed', 'processing', 'picked', 'packed'].includes(o.status)).length ?? 0,
    messages: messages?.filter(m => m.status === 'unread').length ?? 0,
    returns:  returns?.filter(r => ['requested', 'received', 'inspected'].includes(r.status)).length ?? 0,
    stock:    inventory?.filter(r => r.available <= r.reorderThreshold).length ?? 0,
  };

  return (
    <>
      {/* Backdrop — only rendered below `lg` while the drawer is open. */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-sm transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => dispatch(setSidebarOpen(false))}
        aria-hidden="true"
      />

      <aside
        className={clsx(
          'bg-white dark:bg-forest-950 border-r border-stone-200 dark:border-forest-900 flex flex-col shrink-0 no-print',
          // Below `lg`: fixed off-canvas drawer that slides in from the left.
          'fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // From `lg` up: pin to the viewport (sticky, full height) so the nav
          // scrolls internally and the store switcher / account footer stay
          // visible regardless of how long the main content is.
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:w-60 lg:z-auto',
        )}
        aria-label="Primary navigation"
      >
        <div className="px-5 pt-6 pb-5 border-b border-stone-200 dark:border-forest-900 flex items-start justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-brand-700 text-white grid place-items-center">
              <span className="font-serif text-lg leading-none translate-y-[1px]">G</span>
            </div>
            <div>
              <div className="font-serif text-xl text-stone-900 dark:text-stone-100 leading-none">Gaarsii</div>
              <div className="text-2xs text-stone-500 dark:text-stone-400 mt-1 tracking-wide uppercase">Seller portal</div>
            </div>
          </Link>
          {/* Close button — only meaningful inside the drawer. */}
          <button
            type="button"
            onClick={() => dispatch(setSidebarOpen(false))}
            className="lg:hidden -mr-1 p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-50 dark:hover:bg-forest-900"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {visibleItems.map(({ href, label, icon: Icon, kind }) => {
            const isActive = pathname === href || pathname?.startsWith(href + '/');
            const badge = kind ? counts[kind] : 0;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-800 font-medium dark:bg-brand-900/40 dark:text-brand-100'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-forest-900 dark:hover:text-stone-100'
                )}
              >
                <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300')} strokeWidth={2} />
                <span className="flex-1">{label}</span>
                {kind && badge > 0 && (
                  <span className={clsx(
                    'text-2xs font-medium px-1.5 py-0.5 rounded',
                    kind === 'stock' && badge > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                      : 'bg-stone-100 text-stone-600 dark:bg-forest-900 dark:text-stone-300'
                  )}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <StoreSwitcher />

        <Link
          href="/settings"
          className="shrink-0 px-4 py-3 border-t border-stone-200 dark:border-forest-900 hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors text-left flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-md bg-brand-100 dark:bg-brand-900 grid place-items-center text-xs font-medium text-brand-800 dark:text-brand-100 shrink-0">
            {getSidebarInitials(user?.firstName, user?.lastName, user?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
              {user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : 'Account'}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
              {user?.email ?? 'Sign in to continue'}
            </div>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 shrink-0" strokeWidth={2} />
        </Link>
      </aside>
    </>
  );
}
