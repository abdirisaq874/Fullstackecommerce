'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { WhatsAppButton } from './WhatsAppButton';

// Auth screens (login/register/password) render their own full-page split
// layout — they must NOT show the storefront header, footer or cart drawer.
const BARE_ROUTES = ['/login', '/register', '/reset-password', '/forgot-password'];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const bare = BARE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (bare) return <main className="min-h-screen">{children}</main>;

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      {/* Inside the non-bare branch on purpose: no support button on the
          login/register split-screen pages. */}
      <WhatsAppButton />
    </>
  );
}
