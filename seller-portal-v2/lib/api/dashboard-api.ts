import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';
import type { Notification, DashboardMetrics, ProductLeaderboardEntry } from '@/lib/types';

// Shape of each point in the /admin/dashboard/revenue series.
export interface RevenuePoint {
  date: string;   // 'YYYY-MM-DD'
  revenue: number;
  orders: number;
}

// ────────────────────────────────────────────────────────────
// Notifications
//
// Backend (NotificationController, prefix /notifications):
//   GET   /notifications              → list current user's notifications
//   GET   /notifications/unread-count → { count }
//   PATCH /notifications/:id/read     → mark a single notification as read
//
// NOTE: there is no bulk "mark all as read" endpoint yet. We fan out
// individual PATCH /notifications/:id/read calls client-side as a stopgap,
// driven by the cached list (read=false entries). When the backend grows a
// real bulk endpoint, swap the queryFn for a single `query: () => ...` call.
// ────────────────────────────────────────────────────────────

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listNotifications: builder.query<Notification[], void>({
      query: () => ({ url: '/notifications', method: 'GET' }),
      transformResponse: (
        res:
          | ResponseEnvelope<{ data: Notification[] } | Notification[]>
          | { data: Notification[] }
          | Notification[],
      ): Notification[] => {
        // Backend `/notifications` returns a paginated payload
        // `{ data: [...], meta }` inside the TransformInterceptor envelope.
        // Unwrap the outer envelope, then pull `.data` from the inner one.
        const unwrapped = unwrapEnvelope<{ data: Notification[] } | Notification[]>(res);
        if (
          unwrapped &&
          typeof unwrapped === 'object' &&
          Array.isArray((unwrapped as { data?: unknown }).data)
        ) {
          return (unwrapped as { data: Notification[] }).data;
        }
        return Array.isArray(unwrapped) ? unwrapped : [];
      },
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    markNotificationRead: builder.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    // TODO(backend): expose a bulk endpoint such as
    //   PATCH /notifications/read-all
    // and replace this `queryFn` with a single `query: () => ({ url, method })`.
    // For now we fan out the existing per-id PATCH against the cached list.
    markAllNotificationsRead: builder.mutation<void, void>({
      async queryFn(_arg, { dispatch }, _extra, fetchWithBQ) {
        const listResult = await dispatch(
          notificationsApi.endpoints.listNotifications.initiate(undefined, { forceRefetch: true }),
        ).unwrap().catch(() => [] as Notification[]);

        const unreadIds = (listResult ?? []).filter((n) => !n.read).map((n) => n.id);

        for (const id of unreadIds) {
          const result = await fetchWithBQ({ url: `/notifications/${id}/read`, method: 'PATCH' });
          if (result.error) {
            return { error: result.error };
          }
        }
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
    }),
  }),
});

// ────────────────────────────────────────────────────────────
// Dashboard / analytics
//
// Backend (AdminController, prefix /admin):
//   GET /admin/dashboard/stats             → DashboardMetrics-ish payload
//   GET /admin/dashboard/revenue?days=N    → revenue chart series
//   GET /admin/dashboard/orders-by-status  → status buckets
//
// There is currently NO dedicated winning/sliding-products endpoint. The
// closest existing surface is `GET /products` (search), which does not yet
// support a `sortBy=salesCount` parameter — see ProductQueryDto. We mark
// those two endpoints as TODO and return empty arrays for now so the UI
// renders an empty state instead of crashing.
// ────────────────────────────────────────────────────────────

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardMetrics: builder.query<DashboardMetrics, void>({
      query: () => ({ url: '/admin/dashboard/stats', method: 'GET' }),
      transformResponse: (
        res: ResponseEnvelope<Partial<DashboardMetrics>> | Partial<DashboardMetrics>,
      ): DashboardMetrics => {
        // Backend `/admin/dashboard/stats` returns only a subset of the rich
        // DashboardMetrics shape the v2 dashboard was designed against
        // (action board, leaderboards, store health, etc.). Synthesize a full
        // default and overlay whatever the backend actually returned so the
        // page renders empty states cleanly for new sellers.
        const partial = unwrapEnvelope<Partial<DashboardMetrics>>(res) ?? {};
        const empty: DashboardMetrics = {
          grossSales: 0,
          netRevenue: 0,
          profit: 0,
          ordersToday: 0,
          ordersThisWeek: 0,
          pendingFulfillment: 0,
          lowStockSkus: 0,
          unrepliedMessages: 0,
          pendingReturns: 0,
          weekRevenue: [],
          weekProfit: [],
          weekLabels: [],
          costs: {
            productCost: 0,
            platformFee: 0,
            paymentFee: 0,
            shippingCost: 0,
            refundCost: 0,
          },
          health: {
            rating: 0,
            onTimeShipmentPct: 0,
            cancellationRatePct: 0,
            returnRatePct: 0,
            responseRatePct: 0,
          },
          actionBoard: { fix: [], watch: [], scale: [] },
        };
        return {
          ...empty,
          ...partial,
          costs: { ...empty.costs, ...(partial.costs ?? {}) },
          health: { ...empty.health, ...(partial.health ?? {}) },
          actionBoard: {
            fix: partial.actionBoard?.fix ?? empty.actionBoard.fix,
            watch: partial.actionBoard?.watch ?? empty.actionBoard.watch,
            scale: partial.actionBoard?.scale ?? empty.actionBoard.scale,
          },
        };
      },
      providesTags: [{ type: 'Dashboard', id: 'METRICS' }],
    }),

    // TODO(backend): add a dedicated endpoint such as
    //   GET /admin/dashboard/winning-products?limit=10
    // returning ProductLeaderboardEntry[]. Until then, the closest existing
    // surface is `GET /products`, but it has no `sortBy=salesCount` support
    // (see ProductQueryDto), so we return an empty leaderboard.
    getWinningProducts: builder.query<ProductLeaderboardEntry[], void>({
      query: () => ({
        url: '/products',
        method: 'GET',
        params: { limit: 10 },
      }),
      transformResponse: (
        _res: ResponseEnvelope<unknown> | unknown,
      ): ProductLeaderboardEntry[] => {
        // Backend list shape doesn't match ProductLeaderboardEntry yet — drop
        // the payload and return an empty array until the real endpoint exists.
        return [];
      },
      providesTags: [{ type: 'Dashboard', id: 'WINNERS' }],
    }),

    // TODO(backend): add a dedicated endpoint such as
    //   GET /admin/dashboard/sliding-products?limit=10
    // returning ProductLeaderboardEntry[]. Same situation as winning-products.
    getSlidingProducts: builder.query<ProductLeaderboardEntry[], void>({
      query: () => ({
        url: '/products',
        method: 'GET',
        params: { limit: 10 },
      }),
      transformResponse: (
        _res: ResponseEnvelope<unknown> | unknown,
      ): ProductLeaderboardEntry[] => {
        return [];
      },
      providesTags: [{ type: 'Dashboard', id: 'SLIDERS' }],
    }),

    // GET /admin/dashboard/revenue?days=N
    // Backend returns an array of { date: 'YYYY-MM-DD', revenue, orders }
    // where `revenue` is summed from order.total (a plain number, not cents).
    getRevenue: builder.query<RevenuePoint[], { days?: number } | void>({
      query: (arg) => ({
        url: '/admin/dashboard/revenue',
        method: 'GET',
        params: { days: (arg && arg.days) ?? 30 },
      }),
      transformResponse: (
        res: ResponseEnvelope<RevenuePoint[]> | RevenuePoint[],
      ): RevenuePoint[] => {
        const data = unwrapEnvelope<RevenuePoint[]>(res);
        return Array.isArray(data) ? data : [];
      },
      providesTags: (_r, _e, arg) => [
        { type: 'Dashboard', id: `REVENUE_${(arg && arg.days) ?? 30}` },
      ],
    }),

    getOrdersByStatus: builder.query<unknown, void>({
      query: () => ({ url: '/admin/dashboard/orders-by-status', method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<unknown> | unknown) =>
        unwrapEnvelope<unknown>(res),
      providesTags: [{ type: 'Dashboard', id: 'ORDERS_BY_STATUS' }],
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
  useGetRevenueQuery,
  useGetOrdersByStatusQuery,
} = dashboardApi;
