import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../store";

const baseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// Wrapper that handles 401 → auto-refresh token
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const refreshToken = (api.getState() as RootState).auth.refreshToken;
    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
          body: { refreshToken },
        },
        api,
        extraOptions,
      );

      if (refreshResult.data) {
        api.dispatch({
          type: "auth/setCredentials",
          payload: (refreshResult.data as any).data,
        });
        // Retry original request
        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch({ type: "auth/logout" });
      }
    }
  }

  // Unwrap the { success, data } envelope from the backend TransformInterceptor
  if (
    result.data &&
    typeof result.data === "object" &&
    "success" in (result.data as Record<string, unknown>) &&
    "data" in (result.data as Record<string, unknown>)
  ) {
    result.data = (result.data as Record<string, unknown>).data;
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Product",
    "Products",
    "Categories",
    "Brands",
    "Order",
    "Orders",
    "Inventory",
    "Cart",
    "Customers",
    "Notifications",
    "DashboardStats",
    "Coupons",
  ],
  endpoints: () => ({}),
});
