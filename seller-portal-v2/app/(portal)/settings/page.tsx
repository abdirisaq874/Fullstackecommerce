'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { SETTINGS_SECTIONS } from './_components/settings-sidebar';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your store, team, and account" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SETTINGS_SECTIONS.map(({ slug, title, description, icon: Icon }) => (
          <Link key={slug} href={`/settings/${slug}`} className="block">
            <Card className="p-5 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer h-full">
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
          </Link>
        ))}
      </div>
    </>
  );
}
