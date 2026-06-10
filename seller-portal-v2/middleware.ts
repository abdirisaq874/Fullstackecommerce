import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js middleware for seller-portal route protection.
 *
 * Auth model:
 * - Access and refresh tokens are stored in `localStorage` under the keys
 *   `sellerPortal.accessToken` and `sellerPortal.refreshToken`. These are
 *   written by the `authSlice` (see B2) after a successful login/register
 *   and read by the RTK Query `baseApi` to attach the Bearer header.
 * - Because `localStorage` is not available to server-side middleware, the
 *   `authSlice` also writes a non-sensitive presence cookie named
 *   `sellerPortal.hasSession`. This cookie holds no token material — it is
 *   purely a flag the middleware can read to decide whether a request is
 *   plausibly authenticated.
 * - The real authorization check still happens on the backend via the Bearer
 *   token. The middleware only short-circuits obviously-unauthenticated
 *   navigation to keep portal pages from flashing before the client hydrates.
 *
 * Behavior:
 * - Requests to any portal route (matched by the `config.matcher` below) are
 *   redirected to `/login?from=<pathname>` when the `sellerPortal.hasSession`
 *   cookie is missing.
 * - Requests to `/login` or `/register` that already carry the session cookie
 *   are redirected to `/dashboard` to avoid showing the auth screens to an
 *   authenticated user.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has('sellerPortal.hasSession');

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  // Authenticated users should not see the login/register pages.
  if (isAuthRoute && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Anything reaching here that is NOT a public auth route is a portal route
  // (the matcher already excludes api, static assets, login, register,
  // forgot-password, reset-password). Require the presence cookie.
  if (!isAuthRoute && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password).*)',
  ],
};
