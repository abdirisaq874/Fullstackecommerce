'use client';

import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { SettingsSidebar } from './settings-sidebar';

/**
 * Common layout for a settings sub-page: breadcrumb + sidebar + main panel.
 *
 * Each sub-page wraps its form in `<SettingsShell title="…" subtitle="…">`
 * so the sidebar/header chrome stays consistent without us promoting it to
 * a real Next.js layout (the parent /settings route is a landing page in
 * its own right and would re-render the sidebar at that level too).
 */
export function SettingsShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: title }]}
        actions={actions}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-2">
            <SettingsSidebar />
          </Card>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
