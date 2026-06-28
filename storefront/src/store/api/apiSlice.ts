import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { API_URL } from '@/lib/utils';
import type { RootState } from '@/store';
import { setCredentials, logout } from '@/store/slices/authSlice';
import type { AuthTokens } from '@/types';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

// The backend wraps every successful response in a global envelope
// ({ success, data, timestamp } — see TransformInterceptor). Unwrap to the
// inner `data` so endpoints receive the shape their types expect (arrays,
// Paginated<T>, AuthTokens, …) instead of crashing on `envelope.slice/.map`.
const isEnvelope = (body: unknown): body is { success: boolean; data: unknown } =>
  typeof body === 'object' && body !== null && 'success' in body && 'data' in body;

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.data !== undefined && isEnvelope(result.data)) {
    return { ...result, data: result.data.data };
  }
  return result;
};

// Single in-flight refresh shared across concurrent 401s.
let refreshing: Promise<AuthTokens | null> | null = null;

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = (api.getState() as RootState).auth.refreshToken;
    if (!refreshToken) {
      api.dispatch(logout());
      return result;
    }

    if (!refreshing) {
      refreshing = (async () => {
        try {
          const r = await baseQuery(
            { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
            api,
            extraOptions,
          );
          return r.data ? (r.data as AuthTokens) : null;
        } finally {
          // cleared after the awaiting callers below read it
          setTimeout(() => (refreshing = null), 0);
        }
      })();
    }

    const tokens = await refreshing;
    if (tokens?.accessToken) {
      api.dispatch(setCredentials(tokens));
      result = await baseQuery(args, api, extraOptions); // retry original
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Cart', 'Order', 'Address', 'Profile', 'Wishlist', 'Reviews',
    'Returns', 'Threads', 'Thread', 'Product', 'Products', 'Categories', 'Brands',
  ],
  endpoints: () => ({}),
});
