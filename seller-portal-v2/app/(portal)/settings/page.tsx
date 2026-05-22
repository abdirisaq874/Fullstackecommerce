'use client';

import { Store, CreditCard, Receipt, Users, Bell, Lock, Truck, Globe } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import clsx from 'clsx';

const sections = [
  { icon: Store,      title: 'Store profile',     description: 'Name, logo, contact details, hours' },
  { icon: CreditCard, title: 'Payouts & banking', description: 'Bank account, IBAN, schedule, currency' },
  { icon: Receipt,    title: 'Tax & invoicing',   description: 'KDV/VAT, invoice templates, tax IDs' },
  { icon: Users,      title: 'Team',              description: 'Staff accounts, roles, permissions' },
  { icon: Truck,      title: 'Shipping defaults', description: 'Default carrier, packaging, customs' },
  { icon: Globe,      title: 'Languages & locale',description: 'Storefront languages, currencies, formats' },
  { icon: Bell,       title: 'Notifications',     description: 'Email and in-app alert preferences' },
  { icon: Lock,       title: 'Security',          description: '2FA, sessions, API keys' },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your store, team, and account" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(({ icon: Icon, title, description }) => (
          <Card key={title} className={clsx('p-5 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer')}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 grid place-items-center shrink-0">
                <Icon className="w-4 h-4 text-brand-700" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-stone-900">{title}</h3>
                <p className="text-xs text-stone-500 mt-1">{description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
