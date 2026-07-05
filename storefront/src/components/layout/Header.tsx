'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, ShoppingBag, Heart, User, Menu, X, ChevronDown, LogOut, Package, MapPin,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, SITE_NAME } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';
import { useAppDispatch, useAppSelector } from '@/store';
import { openCart } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';
import { useCategoryTreeQuery } from '@/store/api/productsApi';
import { useGetCartQuery } from '@/store/api/cartApi';
import { useSignOutMutation } from '@/store/api/authApi';
import { MegaMenu, MobileCategoryNav } from './MegaMenu';

export function Header() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.accessToken);
  const refreshToken = useAppSelector((s) => s.auth.refreshToken);
  const wishCount = useAppSelector((s) => s.wishlist.items.length);

  const { data: categories } = useCategoryTreeQuery();
  const { data: cart } = useGetCartQuery(undefined, { skip: !token });
  const [signOut] = useSignOutMutation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState('');

  const cartCount = cart?.itemCount ?? 0;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    if (refreshToken) {
      try { await signOut({ refreshToken }).unwrap(); } catch { dispatch(logout()); }
    } else {
      dispatch(logout());
    }
    setAccountOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur">
      {/* Announcement bar */}
      <div className="overflow-hidden bg-ink text-white">
        <div className="container flex h-9 items-center justify-center text-xs font-medium tracking-wide">
          {t('announce')}
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-line">
        <div className="container flex h-16 items-center gap-4">
          <button
            className="focus-ring -ml-2 grid h-10 w-10 place-items-center rounded-lg lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-brand">
            {SITE_NAME}
          </Link>

          {/* Desktop search — with inline dark Search pill */}
          <form onSubmit={submitSearch} className="relative ml-4 hidden flex-1 lg:block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-fg" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nav.searchPlaceholder')}
              className="focus-ring h-12 w-full rounded-full border border-line bg-muted pl-12 pr-28 placeholder:text-muted-fg focus:border-brand focus:bg-surface"
              aria-label={t('nav.search')}
            />
            <button
              type="submit"
              className="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              Search
            </button>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <a href="https://seller.gaarsiiglobal.com" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-muted sm:block">Sell</a>
            <LocaleSwitcher />
            <Link href="/wishlist" className="focus-ring relative grid h-10 w-10 place-items-center rounded-lg hover:bg-muted" aria-label={t('nav.wishlist')}>
              <Heart className="h-5 w-5" />
              {wishCount > 0 && <Count n={wishCount} />}
            </Link>

            {/* Account */}
            <div className="relative">
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="focus-ring flex h-10 items-center gap-1 rounded-lg px-2 hover:bg-muted"
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                <User className="h-5 w-5" />
                <ChevronDown className="hidden h-4 w-4 sm:block" />
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 animate-fade-up rounded-2xl border border-line bg-surface p-2 shadow-lift">
                    {user ? (
                      <>
                        <div className="px-3 py-2">
                          <p className="text-sm font-bold">{user.firstName} {user.lastName}</p>
                          <p className="truncate text-xs text-muted-fg">{user.email}</p>
                        </div>
                        <MenuLink href="/account" icon={<User className="h-4 w-4" />} onClick={() => setAccountOpen(false)}>{t('nav.myAccount')}</MenuLink>
                        <MenuLink href="/account/orders" icon={<Package className="h-4 w-4" />} onClick={() => setAccountOpen(false)}>{t('nav.orders')}</MenuLink>
                        <MenuLink href="/account/addresses" icon={<MapPin className="h-4 w-4" />} onClick={() => setAccountOpen(false)}>{t('nav.addresses')}</MenuLink>
                        <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger/10">
                          <LogOut className="h-4 w-4" /> {t('nav.signOut')}
                        </button>
                      </>
                    ) : (
                      <div className="p-1">
                        <Link href="/login" onClick={() => setAccountOpen(false)} className="block rounded-lg bg-brand-gradient px-3 py-2 text-center text-sm font-bold text-white">{t('nav.signIn')}</Link>
                        <Link href="/register" onClick={() => setAccountOpen(false)} className="mt-1 block rounded-lg px-3 py-2 text-center text-sm font-semibold hover:bg-muted">{t('nav.createAccount')}</Link>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => dispatch(openCart())} className="focus-ring relative grid h-10 w-10 place-items-center rounded-lg hover:bg-muted" aria-label={t('nav.cart')}>
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && <Count n={cartCount} />}
            </button>
          </div>
        </div>

        {/* Category mega menu (desktop) */}
        <MegaMenu categories={categories ?? []} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-80 max-w-[85%] flex-col bg-surface p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-xl font-extrabold text-gradient">{SITE_NAME}</span>
              <button onClick={() => setMobileOpen(false)} className="focus-ring grid h-10 w-10 place-items-center rounded-lg" aria-label="Close menu">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={submitSearch} className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-fg" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="focus-ring h-11 w-full rounded-full border-2 border-line bg-muted/50 pl-11 pr-4" />
            </form>
            <div className="flex-1 overflow-y-auto">
              <Link href="/search" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 font-bold text-accent">{t('nav.allProducts')}</Link>
              <MobileCategoryNav categories={categories ?? []} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
      {n > 9 ? '9+' : n}
    </span>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted')}>
      {icon} {children}
    </Link>
  );
}
