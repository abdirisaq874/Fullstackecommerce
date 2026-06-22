import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';
import { NotificationsPanel } from '@/components/layout/notifications-panel';
import { ToastViewport } from '@/components/layout/toast-viewport';
import { PortalAuthGuard } from '@/components/layout/portal-auth-guard';

/**
 * Portal (authenticated) shell.
 *
 * The shell itself is a server component so each route segment can render its
 * own metadata, but it is wrapped in `<PortalAuthGuard>` (a client component)
 * so we can:
 *   1. Bounce unauthenticated users to `/login?from=<pathname>` immediately
 *      from the client, even when the `sellerPortal.hasSession` cookie is
 *      missing or stale.
 *   2. Keep `GET /users/me` live via `useGetMeQuery`, hydrating the auth slice
 *      whenever the cached user shape changes (role updates, profile edits,
 *      etc).
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalAuthGuard>
      {/* Skip-link — first focusable element on the page so keyboard users can
          jump past the sidebar + topbar. Hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-brand-700 focus:text-white focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen relative">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <Topbar />
          <NotificationsPanel />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-7xl w-full mx-auto focus:outline-none"
          >
            {children}
          </main>
        </div>
        <CommandPalette />
        <ToastViewport />
      </div>
    </PortalAuthGuard>
  );
}
