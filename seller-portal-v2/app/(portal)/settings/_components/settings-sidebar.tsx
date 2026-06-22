'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  Store,
  CreditCard,
  Receipt,
  Users,
  Truck,
  Bell,
  Lock,
} from 'lucide-react';

export interface SettingsSection {
  slug: string;
  title: string;
  description: string;
  icon: typeof Store;
}

/**
 * The seven canonical settings sub-pages.
 *
 * NOTE: keep the order and `title` strings in sync with the cards rendered on
 * /settings (app/(portal)/settings/page.tsx) so the landing grid and the
 * in-page sidebar use identical labels.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { slug: 'store-profile',     title: 'Store profile',     description: 'Name, logo, contact details', icon: Store },
  { slug: 'payouts',           title: 'Payouts & banking', description: 'Bank account, schedule',      icon: CreditCard },
  { slug: 'tax',               title: 'Tax & invoicing',   description: 'Tax ID, default rate',         icon: Receipt },
  { slug: 'team',              title: 'Team',              description: 'Staff accounts, roles',        icon: Users },
  { slug: 'shipping-defaults', title: 'Shipping defaults', description: 'Default zone & handling',      icon: Truck },
  { slug: 'notifications',     title: 'Notifications',     description: 'Email alert preferences',      icon: Bell },
  { slug: 'security',          title: 'Security',          description: 'Password, sessions, 2FA',      icon: Lock },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map(({ slug, title, icon: Icon }) => {
        const href = `/settings/${slug}`;
        const active = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
              active
                ? 'bg-brand-50 text-brand-800 font-medium'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
