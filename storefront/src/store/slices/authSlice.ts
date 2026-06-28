import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthTokens, User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
}

const STORAGE_KEY = 'suuq.auth';

function loadInitial(): AuthState {
  const base: AuthState = { user: null, accessToken: null, refreshToken: null, hydrated: false };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...base, hydrated: true };
    const parsed = JSON.parse(raw);
    return { ...base, ...parsed, hydrated: true };
  } catch {
    return { ...base, hydrated: true };
  }
}

function persist(state: AuthState) {
  if (typeof window === 'undefined') return;
  const { user, accessToken, refreshToken } = state;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken, refreshToken }));
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitial(),
  reducers: {
    hydrate(state) {
      const next = loadInitial();
      state.user = next.user;
      state.accessToken = next.accessToken;
      state.refreshToken = next.refreshToken;
      state.hydrated = true;
    },
    setCredentials(state, action: PayloadAction<AuthTokens>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      persist(state);
    },
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      persist(state);
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    },
  },
});

export const { hydrate, setCredentials, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
