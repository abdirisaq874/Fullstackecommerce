import { apiSlice } from "./apiSlice";
import type { AuthTokens, LoginRequest, RegisterRequest, User } from "../../types";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthTokens, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),

    register: builder.mutation<AuthTokens, RegisterRequest>({
      query: (data) => ({
        url: "/auth/register",
        method: "POST",
        body: data,
      }),
    }),

    getMe: builder.query<User, void>({
      query: () => "/users/me",
    }),

    refreshToken: builder.mutation<AuthTokens, string>({
      query: (refreshToken) => ({
        url: "/auth/refresh",
        method: "POST",
        body: { refreshToken },
      }),
    }),

    logout: builder.mutation<void, string>({
      query: (refreshToken) => ({
        url: "/auth/logout",
        method: "POST",
        body: { refreshToken },
      }),
    }),

    forgotPassword: builder.mutation<{ message: string }, { email: string }>({
      query: (data) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body: data,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetMeQuery,
  useRefreshTokenMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
} = authApi;
