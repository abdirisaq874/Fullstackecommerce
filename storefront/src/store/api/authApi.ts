import { apiSlice } from './apiSlice';
import { setCredentials, setUser, logout } from '@/store/slices/authSlice';
import type { AuthTokens, User } from '@/types';

interface LoginBody { email: string; password: string }
interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthTokens, LoginBody>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setCredentials(data));
        dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true }));
      },
    }),
    register: builder.mutation<AuthTokens, RegisterBody>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setCredentials(data));
        dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true }));
      },
    }),
    me: builder.query<User, void>({
      query: () => '/users/me',
      providesTags: ['Profile'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data));
        } catch {
          /* not logged in */
        }
      },
    }),
    forgotPassword: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<{ message: string }, { token: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    signOut: builder.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try { await queryFulfilled; } finally { dispatch(logout()); }
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useMeQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useSignOutMutation,
} = authApi;
