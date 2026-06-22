/**
 * Auth RTK Query endpoint slice for seller-portal-v2.
 *
 * Mirrors the NestJS `AuthController` endpoints:
 *   POST /auth/register
 *   POST /auth/login
 *   POST /auth/refresh
 *   POST /auth/logout
 *   POST /auth/forgot-password
 *   POST /auth/reset-password
 *   GET  /users/me            (provides the 'User' tag)
 *
 * Response envelope ({ success, data, ... }) is stripped per-endpoint via
 * `unwrapEnvelope` so call-sites work with plain payloads.
 *
 * NOTE: Token persistence (localStorage write on login/register/refresh,
 * removal on logout) lives in Phase 2b's `lib/store/auth-slice.ts`. This
 * slice only describes the network shape — the auth slice subscribes to
 * matchers on these endpoints to keep tokens in sync.
 */
import { baseApi, unwrapEnvelope } from './base-api';
import type { ResponseEnvelope } from './base-api';

// --- domain types -----------------------------------------------------------

/** User role values served by the backend's `UserRole` enum. */
export type UserRole = 'customer' | 'seller' | 'admin';

/**
 * Public user shape returned by `GET /users/me` (and embedded in
 * auth responses, server-side `toJSON` strips `passwordHash`/`__v`).
 *
 * Mongo `_id` is serialised as a string; `id` is also present via the
 * mongoose `virtuals: true` JSON transform.
 */
export interface User {
  _id: string;
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: string;
  addresses?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

// --- request DTOs (mirror backend `src/auth/dto/auth.dto.ts`) ---------------

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  /**
   * Seller portal always registers users with the 'seller' role. The backend
   * `RegisterDto` currently defaults to 'customer'; when the backend honours
   * this field it will be picked up automatically.
   */
  role: 'seller';
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface LogoutDto {
  refreshToken: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// --- response shapes --------------------------------------------------------

/**
 * Shape returned by `/auth/login`, `/auth/register`, and `/auth/refresh`.
 *
 * Backend currently returns `{ accessToken, refreshToken, expiresIn }`; we
 * also surface an optional `user` field so future endpoints (or a server-side
 * upgrade that bundles the user) work without a re-type. Callers that need
 * the user should fall back to `getMe` when `user` is undefined.
 */
export interface AuthResponse {
  user?: User;
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
}

export interface MessageResponse {
  message: string;
}

// --- endpoint slice ---------------------------------------------------------

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginDto>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<AuthResponse> | AuthResponse) =>
        unwrapEnvelope<AuthResponse>(r),
      invalidatesTags: ['User'],
    }),

    register: builder.mutation<AuthResponse, RegisterDto>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<AuthResponse> | AuthResponse) =>
        unwrapEnvelope<AuthResponse>(r),
      invalidatesTags: ['User'],
    }),

    refresh: builder.mutation<AuthResponse, RefreshTokenDto>({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<AuthResponse> | AuthResponse) =>
        unwrapEnvelope<AuthResponse>(r),
      invalidatesTags: ['User'],
    }),

    logout: builder.mutation<MessageResponse, LogoutDto>({
      query: (body) => ({
        url: '/auth/logout',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<MessageResponse> | MessageResponse) =>
        unwrapEnvelope<MessageResponse>(r),
    }),

    getMe: builder.query<User, void>({
      query: () => ({
        url: '/users/me',
        method: 'GET',
      }),
      transformResponse: (r: ResponseEnvelope<User> | User) =>
        unwrapEnvelope<User>(r),
      providesTags: ['User'],
    }),

    forgotPassword: builder.mutation<MessageResponse, ForgotPasswordDto>({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<MessageResponse> | MessageResponse) =>
        unwrapEnvelope<MessageResponse>(r),
    }),

    resetPassword: builder.mutation<MessageResponse, ResetPasswordDto>({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<MessageResponse> | MessageResponse) =>
        unwrapEnvelope<MessageResponse>(r),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshMutation,
  useLogoutMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} = authApi;
