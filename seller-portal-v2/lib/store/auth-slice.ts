/**
 * Auth slice for seller-portal-v2.
 *
 * Canonical owner of the seller-portal auth state and the localStorage keys
 * documented in `lib/api/base-api.ts`. The base API still reads tokens
 * directly from localStorage (so requests fired before React mounts can still
 * carry an Authorization header) — this slice keeps those keys in sync from
 * the Redux side and also drops a non-sensitive `sellerPortal.hasSession`
 * cookie so the Next.js middleware can route unauthenticated users to /login
 * without parsing localStorage.
 *
 * Storage layout:
 *   localStorage['sellerPortal.accessToken']  – JWT (read by base-api)
 *   localStorage['sellerPortal.refreshToken'] – refresh JWT (read by base-api)
 *   localStorage['sellerPortal.user']         – JSON-encoded current User
 *   cookie     'sellerPortal.hasSession=1'    – path=/; max-age=7d
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// --- types ------------------------------------------------------------------

export type UserRole = 'customer' | 'seller' | 'admin';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  emailVerified?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;
}

// --- storage keys (must match base-api.ts) ----------------------------------

const ACCESS_TOKEN_KEY = 'sellerPortal.accessToken';
const REFRESH_TOKEN_KEY = 'sellerPortal.refreshToken';
const USER_KEY = 'sellerPortal.user';
const SESSION_COOKIE = 'sellerPortal.hasSession';
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// --- storage helpers --------------------------------------------------------

function readString(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may throw in private-browsing modes; non-fatal.
  }
}

function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readUser(): User | null {
  const raw = readString(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeUser(user: User): void {
  try {
    writeString(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore JSON.stringify failures (circular structures shouldn't occur here).
  }
}

function setSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

// --- initial state (hydrated from localStorage on first run) ----------------

function buildInitialState(): AuthState {
  const accessToken = readString(ACCESS_TOKEN_KEY);
  const refreshToken = readString(REFRESH_TOKEN_KEY);
  const user = readUser();
  const authed = Boolean(accessToken);
  return {
    user,
    accessToken,
    refreshToken,
    status: authed ? 'authenticated' : 'idle',
  };
}

const initialState: AuthState = buildInitialState();

// --- payloads ---------------------------------------------------------------

export interface SetCredentialsPayload {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SetUserPayload {
  user: User;
}

export interface TokenRefreshedPayload {
  accessToken: string;
  refreshToken: string;
}

// --- slice ------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<SetCredentialsPayload>) => {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.status = 'authenticated';
      writeString(ACCESS_TOKEN_KEY, accessToken);
      writeString(REFRESH_TOKEN_KEY, refreshToken);
      writeUser(user);
      setSessionCookie();
    },
    setUser: (state, action: PayloadAction<SetUserPayload>) => {
      const { user } = action.payload;
      state.user = user;
      writeUser(user);
    },
    tokenRefreshed: (state, action: PayloadAction<TokenRefreshedPayload>) => {
      const { accessToken, refreshToken } = action.payload;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      writeString(ACCESS_TOKEN_KEY, accessToken);
      writeString(REFRESH_TOKEN_KEY, refreshToken);
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.status = 'unauthenticated';
      removeKey(ACCESS_TOKEN_KEY);
      removeKey(REFRESH_TOKEN_KEY);
      removeKey(USER_KEY);
      clearSessionCookie();
    },
  },
});

export const { setCredentials, setUser, tokenRefreshed, logout } = authSlice.actions;
export default authSlice.reducer;

// --- selectors --------------------------------------------------------------

export const selectCurrentUser = (state: { auth: AuthState }): User | null =>
  state.auth.user;

export const selectAccessToken = (state: { auth: AuthState }): string | null =>
  state.auth.accessToken;

export const selectIsAuthenticated = (state: { auth: AuthState }): boolean =>
  state.auth.status === 'authenticated' && state.auth.accessToken !== null;
