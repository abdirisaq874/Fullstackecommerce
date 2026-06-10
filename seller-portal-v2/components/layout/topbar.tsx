'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Bell, Globe, LogOut, Menu, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { setCommandPaletteOpen, setNotificationsPanelOpen, setSidebarOpen } from '@/lib/api/ui-slice';
import { useListNotificationsQuery } from '@/lib/api';
import { useLogoutMutation } from '@/lib/api/auth-api';
import { logout, selectCurrentUser } from '@/lib/store/auth-slice';
import { useHotkey } from '@/lib/hooks/use-hotkey';
import { baseApi } from '@/lib/api/base-api';
import { ThemeToggle } from '@/components/layout/theme-toggle';

/** Initials helper — first letters of first + last name, falls back to email. */
function getInitials(firstName?: string, lastName?: string, email?: string): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  const initials = `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
  if (initials) return initials;
  if (email) return email.charAt(0).toUpperCase();
  return '?';
}

export function Topbar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notifPanelOpen = useAppSelector(s => s.ui.notificationsPanelOpen);
  const user = useAppSelector(selectCurrentUser);
  const refreshToken = useAppSelector(s => s.auth.refreshToken);
  const { data: notifications } = useListNotificationsQuery();
  const unread = notifications?.filter(n => !n.read).length ?? 0;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation();

  useHotkey('cmd+k', (e) => { e.preventDefault(); dispatch(setCommandPaletteOpen(true)); });

  // Close the profile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current || !(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const fullName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
    : '';
  const initials = getInitials(user?.firstName, user?.lastName, user?.email);

  async function handleLogout() {
    setMenuOpen(false);
    try {
      // Best-effort server-side revoke — we still clear local state on
      // failure (network down, token already expired, etc).
      if (refreshToken) {
        await logoutMutation({ refreshToken }).unwrap();
      }
    } catch {
      // Intentionally swallow; client logout below is the source of truth.
    } finally {
      dispatch(logout());
      // Drop every cached RTK Query entry so the next session can't see
      // the previous user's data flash through.
      dispatch(baseApi.util.resetApiState());
      router.push('/login');
    }
  }

  return (
    <header className="h-14 bg-white dark:bg-forest-950 border-b border-stone-200 dark:border-forest-900 flex items-center justify-between gap-2 px-4 sm:px-6 shrink-0 no-print">
      {/* Hamburger — only rendered below `lg`; on lg+ the sidebar is permanently visible. */}
      <button
        type="button"
        onClick={() => dispatch(setSidebarOpen(true))}
        className="lg:hidden -ml-1 p-2 rounded-md text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" strokeWidth={2} />
      </button>

      {/* TODO (H5): on mobile, transform this search trigger into a full-width
          overlay when focused (Algolia-style). Today it just opens the command
          palette which is already full-width on small screens, so this is a
          UX polish, not a correctness fix. */}
      <button
        type="button"
        onClick={() => dispatch(setCommandPaletteOpen(true))}
        className="flex items-center gap-2 flex-1 max-w-md px-2 py-1.5 -mx-2 rounded-md hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors group"
        aria-label="Open command palette"
      >
        <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="text-sm text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-300 flex-1 text-left">
          Search orders, products, customers…
        </span>
        <kbd className="hidden sm:inline-block text-2xs text-stone-400 dark:text-stone-500 border border-stone-200 dark:border-forest-900 rounded px-1.5 py-0.5 font-sans group-hover:border-stone-300 dark:group-hover:border-forest-800">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 px-2.5 py-1.5 rounded-md hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors"
          aria-label="Change display currency (currently USD)"
        >
          <Globe className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          USD
        </button>
        <ThemeToggle className="mx-1" />
        <button
          onClick={() => dispatch(setNotificationsPanelOpen(!notifPanelOpen))}
          className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 p-2 rounded-md hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors relative"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        >
          <Bell className="w-4 h-4" strokeWidth={2} />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white dark:ring-forest-950" />}
        </button>

        {/* Profile menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 ml-1 rounded-md hover:bg-stone-50 dark:hover:bg-forest-900 transition-colors"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={fullName ? `Account menu for ${fullName}` : 'Account menu'}
          >
            <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100 grid place-items-center text-xs font-medium">
              {initials}
            </span>
            <span className="hidden md:inline text-sm text-stone-700 dark:text-stone-200 max-w-[10rem] truncate">
              {fullName || 'Account'}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-forest-950 border border-stone-200 dark:border-forest-900 rounded-lg shadow-lg z-50 overflow-hidden"
            >
              <div className="px-3 py-3 border-b border-stone-100 dark:border-forest-900">
                <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                  {fullName || 'Account'}
                </div>
                {user?.email && (
                  <div className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">{user.email}</div>
                )}
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-forest-900"
                >
                  <UserIcon className="w-4 h-4 text-stone-400 dark:text-stone-500" strokeWidth={2} />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-forest-900"
                >
                  <SettingsIcon className="w-4 h-4 text-stone-400 dark:text-stone-500" strokeWidth={2} />
                  Settings
                </Link>
              </div>

              <div className="border-t border-stone-100 dark:border-forest-900 py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-4 h-4" strokeWidth={2} />
                  {isLoggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
