/**
 * Base RTK Query API for seller-portal-v2.
 *
 * Architecture (outer → inner):
 *
 *   createApi({ baseQuery: baseQueryWithReauth })
 *        │
 *        └── baseQueryWithReauth   (handles 401 → POST /auth/refresh → retry)
 *               │
 *               └── retry(...)     (network/5xx retries, exp. backoff, max 2)
 *                      │
 *                      └── rawBaseQuery  (fetchBaseQuery: real fetch + timeout
 *                                         + Authorization + X-Request-Id)
 *
 * Why this shape:
 *  - The innermost `rawBaseQuery` is a real `fetchBaseQuery` (not the placeholder
 *    `fakeBaseQuery` we started with). It injects auth + tracing headers and
 *    enforces a 30s per-request timeout via AbortController (built in to
 *    fetchBaseQuery's `timeout` option).
 *  - The `retry` wrapper transparently re-issues a request on transient
 *    failures (network FETCH_ERROR, 5xx). We use `retry.fail()` to bail
 *    immediately on 4xx so we don't pointlessly retry validation errors.
 *  - The 401 reauth wrapper sits outside `retry` so a single 401 triggers
 *    exactly one refresh attempt (we don't want retry's loop to keep firing
 *    /auth/refresh once we've already failed).
 *
 * Response envelope:
 *  The NestJS `TransformInterceptor` wraps every success response as
 *  `{ success: true, data: <payload>, timestamp }`. Because RTK Query's
 *  `transformResponse` is per-endpoint, we expose a tiny `unwrapEnvelope<T>`
 *  helper for endpoint slices to call from their own `transformResponse`.
 *  Doing it in one shared place at the baseQuery layer would erase response
 *  metadata (headers, status) and is harder to type per-endpoint.
 *
 * Token storage:
 *  Tokens are persisted under the `sellerPortal.accessToken` and
 *  `sellerPortal.refreshToken` localStorage keys. Phase 2b's `lib/store/auth-slice.ts`
 *  will own these keys (set on login, clear on logout); reading them
 *  directly here keeps A4 self-contained while remaining trivially
 *  forward-compatible.
 */
import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { env } from '@/lib/config/env';

// --- token storage ----------------------------------------------------------

/**
 * LocalStorage keys for seller-portal auth tokens.
 *
 * TODO(phase-2b): `lib/store/auth-slice.ts` will be the canonical owner of
 * these keys (`setCredentials` writes them; `logout` clears them). Once that
 * slice exists, the read helpers below can optionally be migrated to pull
 * from Redux state via `prepareHeaders({ getState })` for a single source
 * of truth — but reading localStorage works correctly today and survives
 * page reloads without any extra wiring.
 */
const ACCESS_TOKEN_KEY = 'sellerPortal.accessToken';
const REFRESH_TOKEN_KEY = 'sellerPortal.refreshToken';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Generates a v4 UUID using `crypto.randomUUID()` (available in modern
 * browsers and Node 19+). Falls back to a Math.random-based id if the
 * platform somehow lacks it — non-cryptographic but adequate for tracing.
 */
function requestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// --- response envelope ------------------------------------------------------

/** Shape produced by the NestJS `TransformInterceptor`. */
export interface ResponseEnvelope<T> {
  success: boolean;
  data: T;
  /** Optional pagination / metadata — present on list endpoints once added server-side. */
  meta?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Unwrap `{ success, data, ... }` to `data`.
 *
 * Endpoint slices call this from their own `transformResponse`:
 *
 * ```ts
 * getProducts: builder.query<Product[], void>({
 *   query: () => '/seller/products',
 *   transformResponse: (res: ResponseEnvelope<Product[]>) => unwrapEnvelope(res),
 * })
 * ```
 *
 * If the response is *not* enveloped (e.g. a route that bypasses the
 * interceptor, or already-unwrapped raw data) we return it untouched.
 */
export function unwrapEnvelope<T>(response: ResponseEnvelope<T> | T): T {
  if (
    response !== null &&
    typeof response === 'object' &&
    'success' in (response as Record<string, unknown>) &&
    'data' in (response as Record<string, unknown>)
  ) {
    return (response as ResponseEnvelope<T>).data;
  }
  return response as T;
}

// --- raw base query ---------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30_000;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('X-Request-Id', requestId());
    return headers;
  },
});

// --- retry wrapper ----------------------------------------------------------

const MAX_RETRIES = 2;

/**
 * Decide whether a failed request is worth retrying.
 *
 * Retry on:
 *   - Network errors (`FETCH_ERROR`)
 *   - 5xx server errors
 * Bail on everything else — 4xx errors mean the request is malformed or
 * unauthorised and won't succeed on a re-attempt.
 *
 * NOTE: `RetryOptions` is a discriminated union — supplying `retryCondition`
 * means we must NOT supply `maxRetries`. We enforce the retry cap by checking
 * `extraArgs.attempt` ourselves.
 */
const baseQueryWithRetry = retry(rawBaseQuery, {
  backoff: async (attempt) => {
    // `attempt` is 1-indexed (1 = first retry). 200ms, then 400ms.
    const delayMs = 200 * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  },
  retryCondition: (error, _args, { attempt }) => {
    if (attempt > MAX_RETRIES) return false;
    // RTK Query's `RetryConditionFunction` types `error` generically as `{}`;
    // narrow it to the concrete fetch error shape produced by `rawBaseQuery`.
    const err = error as FetchBaseQueryError | undefined;
    if (!err) return false;
    if (err.status === 'FETCH_ERROR') return true;
    if (typeof err.status === 'number' && err.status >= 500 && err.status < 600) {
      return true;
    }
    return false;
  },
});

// --- 401 reauth wrapper (single-flight) -------------------------------------

/**
 * Shape of the refresh response (envelope is unwrapped at parse time).
 * The backend's `/auth/refresh` returns `{ accessToken, refreshToken }`
 * inside the standard envelope.
 */
interface RefreshTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Hard-redirect the browser to /login. Used only when a refresh genuinely
 * fails (refresh token truly expired/revoked) so the user lands on the login
 * screen instead of a raw "Unauthorized" error surfacing in the UI. Guards
 * against SSR and against a redirect loop when already on the login page.
 */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;
  window.location.href = '/login';
}

/**
 * A single in-flight refresh shared across all concurrent callers.
 *
 * The backend rotates refresh tokens — each is single-use: `/auth/refresh`
 * deletes the presented token and issues a brand-new pair. If every 401'd
 * request fired its own refresh, the first would succeed and the rest would
 * 401 on the now-deleted token, wiping the session (the bug behind the
 * intermittent "Unauthorized" on the dashboard after the access token
 * expires). Sharing one promise means N concurrent 401s trigger exactly ONE
 * refresh; they all await it, then retry with the freshly-stored token.
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Run one `/auth/refresh` round. Returns the new access token on success, or
 * null if there is no refresh token or the refresh was rejected. Uses the raw
 * baseQuery (no retry) so a failure is a single, decisive attempt.
 */
async function performRefresh(
  api: Parameters<typeof rawBaseQuery>[1],
  extraOptions: Parameters<typeof rawBaseQuery>[2],
): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const refreshResult = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
    api,
    extraOptions,
  );

  if (refreshResult.data) {
    const tokens = unwrapEnvelope<RefreshTokens>(
      refreshResult.data as ResponseEnvelope<RefreshTokens> | RefreshTokens,
    );
    setTokens(tokens.accessToken, tokens.refreshToken);
    // TODO(phase-2b): once `lib/store/auth-slice.ts` exists, also dispatch
    //   api.dispatch({ type: 'auth/setCredentials', payload: tokens });
    return tokens.accessToken;
  }
  return null;
}

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQueryWithRetry(args, api, extraOptions);

  // Auth endpoints (login/register/refresh) return 401 on genuine credential
  // or token failures — never try to "refresh" those; let the error through.
  const url = typeof args === 'string' ? args : args.url;
  const isAuthRoute = url.startsWith('/auth/');

  if (result.error && result.error.status === 401 && !isAuthRoute) {
    // Single-flight guard: start a refresh only if one isn't already running.
    // All concurrent 401s await the SAME promise, so only one `/auth/refresh`
    // is sent. The `.finally` clears the shared promise once it settles, so the
    // next time the access token expires a fresh refresh can run.
    if (!refreshPromise) {
      refreshPromise = performRefresh(api, extraOptions).finally(() => {
        refreshPromise = null;
      });
    }
    const newAccessToken = await refreshPromise;

    if (newAccessToken) {
      // Retry the original request with the freshly-stored access token.
      result = await baseQueryWithRetry(args, api, extraOptions);
    } else {
      // Refresh genuinely failed (refresh token expired/revoked). End the
      // session cleanly and route to login instead of surfacing a raw 401.
      clearTokens();
      redirectToLogin();
    }
  }

  return result;
};

// --- public API -------------------------------------------------------------

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    // Existing tags (phase 1 scaffold)
    'Product',
    'Order',
    'Inventory',
    'Return',
    'Message',
    'Notification',
    'Dashboard',
    'Customer',
    // Future-phase tags reserved here so endpoint slices in later phases
    // don't have to amend the base.
    'User',
    'Coupon',
    'ShippingZone',
    'Payout',
    'Settings',
  ],
  endpoints: () => ({}),
  // refetchOnFocus / refetchOnReconnect intentionally left off here; turn
  // them on at the <ApiProvider /> or per-endpoint once we have a feel for
  // the request volume against the real backend.
});

