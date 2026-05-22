import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';
import { NotificationsPanel } from '@/components/layout/notifications-panel';
import { ToastViewport } from '@/components/layout/toast-viewport';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen relative">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Topbar />
        <NotificationsPanel />
        <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
      <CommandPalette />
      <ToastViewport />
    </div>
  );
}
