/**
 * H7 example test — auth-slice reducers.
 *
 * Verifies:
 *  1. setCredentials writes the access/refresh tokens + user JSON to
 *     localStorage under the keys documented in `lib/api/base-api.ts`.
 *  2. logout removes those keys from localStorage.
 *  3. selectIsAuthenticated reflects the slice status correctly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import authReducer, {
  setCredentials,
  logout,
  selectIsAuthenticated,
  type AuthState,
  type User,
} from '../auth-slice';

const ACCESS_TOKEN_KEY = 'sellerPortal.accessToken';
const REFRESH_TOKEN_KEY = 'sellerPortal.refreshToken';
const USER_KEY = 'sellerPortal.user';

const mockUser: User = {
  _id: 'u_1',
  email: 'seller@example.com',
  firstName: 'Sela',
  lastName: 'Seller',
  role: 'seller',
};

function initialState(): AuthState {
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    status: 'idle',
  };
}

describe('auth-slice', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('setCredentials persists tokens + user to localStorage and flips status', () => {
    const next = authReducer(
      initialState(),
      setCredentials({
        user: mockUser,
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      }),
    );

    expect(next.status).toBe('authenticated');
    expect(next.accessToken).toBe('access-123');
    expect(next.refreshToken).toBe('refresh-456');
    expect(next.user).toEqual(mockUser);

    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('access-123');
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-456');
    expect(window.localStorage.getItem(USER_KEY)).toBe(JSON.stringify(mockUser));
  });

  it('logout clears tokens + user from localStorage', () => {
    // First sign in so we have something to clear.
    const signedIn = authReducer(
      initialState(),
      setCredentials({
        user: mockUser,
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      }),
    );
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('access-123');

    const next = authReducer(signedIn, logout());

    expect(next.status).toBe('unauthenticated');
    expect(next.user).toBeNull();
    expect(next.accessToken).toBeNull();
    expect(next.refreshToken).toBeNull();

    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('selectIsAuthenticated returns true only when authenticated with a token', () => {
    expect(selectIsAuthenticated({ auth: initialState() })).toBe(false);

    const authed: AuthState = {
      user: mockUser,
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      status: 'authenticated',
    };
    expect(selectIsAuthenticated({ auth: authed })).toBe(true);

    const tokenButIdle: AuthState = { ...authed, status: 'idle' };
    expect(selectIsAuthenticated({ auth: tokenButIdle })).toBe(false);
  });
});
