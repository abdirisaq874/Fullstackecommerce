import { apiSlice } from "./apiSlice";
import type {
  Order, PaginatedResponse, Inventory, AdjustStockRequest,
  DashboardStats, Notification, Coupon, User,
} from "../../types";
import { toQueryString } from "../../lib/utils";

// ─── Orders API ───
export const ordersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<PaginatedResponse<Order>, { page?: number; limit?: number; status?: string }>({
      query: (params) => `/orders?${toQueryString(params)}`,
      providesTags: (result) =>
        result
          ? [...result.data.map(({ _id }) => ({ type: "Order" as const, id: _id })), { type: "Orders", id: "LIST" }]
          : [{ type: "Orders", id: "LIST" }],
    }),

    getOrder: builder.query<Order, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (result, error, id) => [{ type: "Order", id }],
    }),

    updateOrderStatus: builder.mutation<Order, { id: string; status: string; reason?: string }>({
      query: ({ id, ...body }) => ({
        url: `/admin/orders/${id}/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Order", id },
        { type: "Orders", id: "LIST" },
        "DashboardStats",
      ],
    }),
  }),
});

// ─── Inventory API ───
export const inventoryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProductInventory: builder.query<Inventory[], string>({
      query: (productId) => `/inventory/product/${productId}`,
      providesTags: (result, error, productId) => [{ type: "Inventory", id: productId }],
    }),

    checkStock: builder.query<{ sku: string; available: number }, string>({
      query: (sku) => `/inventory/check/${sku}`,
    }),

    adjustStock: builder.mutation<Inventory, AdjustStockRequest>({
      query: (data) => ({
        url: "/inventory/adjust",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Inventory"],
    }),
  }),
});

// ─── Dashboard API ───
export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, void>({
      query: () => "/admin/dashboard/stats",
      providesTags: ["DashboardStats"],
    }),

    getRevenueChart: builder.query<{ date: string; revenue: number; orders: number }[], number | void>({
      query: (days = 7) => `/admin/dashboard/revenue?days=${days}`,
    }),

    getOrdersByStatus: builder.query<{ _id: string; count: number }[], void>({
      query: () => "/admin/dashboard/orders-by-status",
    }),
  }),
});

// ─── Notifications API ───
export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<PaginatedResponse<Notification>, { page?: number; limit?: number }>({
      query: (params) => `/notifications?${toQueryString(params)}`,
      providesTags: ["Notifications"],
    }),

    getUnreadCount: builder.query<{ count: number }, void>({
      query: () => "/notifications/unread-count",
      providesTags: ["Notifications"],
    }),

    markAsRead: builder.mutation<void, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),
  }),
});

// ─── Customers API (Admin) ───
export const customersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCustomers: builder.query<PaginatedResponse<User>, { page?: number; limit?: number; q?: string }>({
      query: (params) => `/admin/users?role=customer&${toQueryString(params)}`,
      providesTags: ["Customers"],
    }),
  }),
});

// ─── Coupons API ───
export const couponsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCoupons: builder.query<Coupon[], void>({
      query: () => "/admin/coupons",
      providesTags: ["Coupons"],
    }),

    createCoupon: builder.mutation<Coupon, Partial<Coupon>>({
      query: (data) => ({
        url: "/admin/coupons",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Coupons"],
    }),
  }),
});

// ─── Export Hooks ───
export const { useGetOrdersQuery, useGetOrderQuery, useUpdateOrderStatusMutation } = ordersApi;
export const { useGetProductInventoryQuery, useCheckStockQuery, useAdjustStockMutation } = inventoryApi;
export const { useGetDashboardStatsQuery, useGetRevenueChartQuery, useGetOrdersByStatusQuery } = dashboardApi;
export const { useGetNotificationsQuery, useGetUnreadCountQuery, useMarkAsReadMutation } = notificationsApi;
export const { useGetCustomersQuery } = customersApi;
export const { useGetCouponsQuery, useCreateCouponMutation } = couponsApi;
