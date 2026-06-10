'use client';

/**
 * Client-side auth guard for the (portal) route group.
 *
 * Responsibilities:
 *   1. Subscribe to `GET /users/me` via `useGetMeQuery` so the live user shape
 *      stays current; pipe any returned user back into the auth slice with
 *      `setUser` so `selectCurrentUser` is the single source of truth across
 *      sidebar, topbar, and pages.
 *   2. Treat the user as authenticated when EITHER the access token is
 *      present in the Redux auth slice OR `useGetMeQuery` has returned a
 *      user. This avoids a flash of "unauthenticated" on hard navigations
 *      where Redux hydrates a tick before the first /users/me response.
 *   3. Redirect unauthenticated, non-loading visitors to
 *      `/login?from=<pathname>` so the login page can route them back.
 *
 * The Next.js middleware (which checks the `sellerPortal.hasSession` cookie)
 * is the first line of defense; this guard is the in-page fallback for cases
 * where the cookie is missing (private browsing, manual clear, etc.).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useGetMeQuery } from '@/lib/api/auth-api';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import {
  selectAccessToken,
  selectCurrentUser,
  setUser,
  type User as AuthUser,
} from '@/lib/store/auth-slice';

interface PortalAuthGuardProps {
  children: ReactNode;
}

export function PortalAuthGuard({ children }: PortalAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  // The auth slice's initial state reads from localStorage, which only exists
  // on the client. SSR renders with no token / no user (spinner branch); the
  // first client render after hydration sees the real token (children branch),
  // causing a hydration mismatch. Gate the auth-dependent render on a mount
  // flag so SSR and the first client render produce identical markup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const accessToken = useAppSelector(selectAccessToken);
  const cachedUser = useAppSelector(selectCurrentUser);

  // Only fire /users/me when we have a token to send; without one the request
  // would 401 and immediately trip the global error toast.
  const { data: liveUser, isLoading, isFetching, isError } = useGetMeQuery(
    undefined,
    { skip: !accessToken },
  );

  // Mirror the live /users/me payload back into the auth slice so all other
  // components reading `selectCurrentUser` see the latest profile data.
  useEffect(() => {
    if (!liveUser) return;
    dispatch(
      setUser({
        user: {
          _id: liveUser._id,
          email: liveUser.email,
          firstName: liveUser.firstName,
          lastName: liveUser.lastName,
          phone: liveUser.phone,
          avatarUrl: liveUser.avatarUrl,
          role: liveUser.role,
          emailVerified: liveUser.emailVerified,
          isActive: liveUser.isActive,
          createdAt: liveUser.createdAt,
          updatedAt: liveUser.updatedAt,
        } satisfies AuthUser,
      }),
    );
  }, [liveUser, dispatch]);

  // Authenticated when either side of the world says so: a token is in the
  // slice (sync, available immediately on mount) OR /users/me returned a user.
  const isAuthenticated = Boolean(accessToken) || Boolean(cachedUser) || Boolean(liveUser);

  // While we have a token but no resolved user yet, keep showing the spinner
  // so we don't flash either the redirect or the shell with empty data.
  const isResolving = Boolean(accessToken) && !cachedUser && (isLoading || isFetching);

  useEffect(() => {
    if (isAuthenticated || isResolving) return;
    // Avoid spinning on a loop if /users/me errored while we had a token —
    // treat that as unauthenticated and bounce to login. The login page will
    // honour `?from=` and route the user back.
    const from = pathname || '/dashboard';
    router.replace(`/login?from=${encodeURIComponent(from)}`);
  }, [isAuthenticated, isResolving, router, pathname, isError]);

  if (!mounted || isResolving || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-5 h-5 text-brand-700 animate-spin" strokeWidth={2} />
      </div>
    );
  }

  return <>{children}</>;
}
