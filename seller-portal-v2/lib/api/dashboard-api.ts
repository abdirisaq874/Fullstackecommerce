import { baseApi, delay } from './base-api';
import { db, computeDashboard, computeWinningProducts, computeSlidingProducts } from './mock-db';
import type { Notification, DashboardMetrics, ProductLeaderboardEntry } from '@/lib/types';

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listNotifications: builder.query<Notification[], void>({
      async queryFn() {
        await delay(120);
        return { data: db.notifications };
      },
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    markNotificationRead: builder.mutation<void, string>({
      async queryFn(id) {
        await delay(80);
        db.notifications = db.notifications.map(n => n.id === id ? { ...n, read: true } : n);
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    markAllNotificationsRead: builder.mutation<void, void>({
      async queryFn() {
        await delay(120);
        db.notifications = db.notifications.map(n => ({ ...n, read: true }));
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
  }),
});

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardMetrics: builder.query<DashboardMetrics, void>({
      async queryFn() {
        await delay(250);
        return { data: computeDashboard() };
      },
      providesTags: [{ type: 'Dashboard', id: 'METRICS' }],
    }),

    getWinningProducts: builder.query<ProductLeaderboardEntry[], void>({
      async queryFn() {
        await delay(180);
        return { data: computeWinningProducts() };
      },
      providesTags: [{ type: 'Dashboard', id: 'WINNERS' }],
    }),

    getSlidingProducts: builder.query<ProductLeaderboardEntry[], void>({
      async queryFn() {
        await delay(180);
        return { data: computeSlidingProducts() };
      },
      providesTags: [{ type: 'Dashboard', id: 'SLIDERS' }],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;

export const {
  useGetDashboardMetricsQuery,
  useGetWinningProductsQuery,
  useGetSlidingProductsQuery,
} = dashboardApi;
