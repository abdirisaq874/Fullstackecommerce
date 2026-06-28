'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, Package, MapPin, Settings, RefreshCcw, MessageSquare, LogOut, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from '@/components/ui';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { useSignOutMutation } from '@/store/api/authApi';

const NAV = [
  { href: '/account', label: 'Overview', icon: User, exact: true },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/returns', label: 'Returns', icon: RefreshCcw },
  { href: '/account/messages', label: 'Messages', icon: MessageSquare },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/profile', label: 'Profile & settings', icon: Settings },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const [signOut] = useSignOutMutation();

  const handleLogout = async () => {
    if (refreshToken) { try { await signOut({ refreshToken }).unwrap(); } catch { dispatch(logout()); } }
    else dispatch(logout());
    router.push('/');
  };

  return (
    <RequireAuth message="Sign in to access your account.">
      <Container className="py-10">
        <h1 className="mb-6 font-display text-3xl font-extrabold">
          {user ? `Hi, ${user.firstName} 👋` : 'My account'}
        </h1>
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside>
            <nav className="space-y-1">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition', active ? 'bg-brand-gradient text-white shadow-pop' : 'hover:bg-muted')}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
              <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger/10">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </RequireAuth>
  );
}
