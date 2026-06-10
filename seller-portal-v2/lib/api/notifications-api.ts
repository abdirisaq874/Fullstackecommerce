import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';
import type { Notification } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Notifications
//
// Backend (NotificationController, prefix /notifications):
//   GET   /notifications              → list current user's notifications (paginated)
//   GET   /notifications/unread-count → { count }
//   PATCH /notifications/:id/read     → mark a single notification as read
//
// NOTE: there is no bulk "mark all as read" endpoint yet. We fan out
// individual PATCH /notifications/:id/read calls client-side as a stopgap,
// driven by the cached list (read=false entries). When the backend grows a
// real bulk endpoint (e.g. POST /notifications/mark-all-read), swap the
// queryFn for a single `query: () => ...` call.
// ────────────────────────────────────────────────────────────

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
}

interface UnreadCountResponse {
  count: number;
}

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * GET /notifications — paginated list of the current user's notifications.
     * Backend returns a `PaginatedResponseDto<Notification>` shape inside the
     * standard envelope, so after `unwrapEnvelope` we peel `.data` off to get
     * the flat array consumers expect.
     */
    getNotifications: builder.query<Notification[], ListNotificationsParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/notifications',
          method: 'GET',
          params: {
            page: p.page,
            limit: p.limit,
          },
        };
      },
      transformResponse: (
        res: ResponseEnvelope<{ data: Notification[] } | Notification[]> | { data: Notification[] } | Notification[],
      ): Notification[] => {
        const unwrapped = unwrapEnvelope<{ data: Notification[] } | Notification[]>(res);
        if (unwrapped && typeof unwrapped === 'object' && Array.isArray((unwrapped as { data?: unknown }).data)) {
          return (unwrapped as { data: Notification[] }).data;
        }
        return (unwrapped as Notification[]) ?? [];
      },
      providesTags: [{ type: 'Notification', id: 'LIST' }],
    }),

    /**
     * GET /notifications/unread-count → { count }
     *
     * Consumers can opt into polling via the standard RTK Query
     * `pollingInterval` option on the hook, e.g.:
     *
     *   useGetUnreadCountQuery(undefined, { pollingInterval: 30_000 });
     *
     * No polling default is set here so quiet screens don't generate
     * needless background traffic.
     */
    getUnreadCount: builder.query<number, void>({
      query: () => ({ url: '/notifications/unread-count', method: 'GET' }),
      transformResponse: (
        res: ResponseEnvelope<UnreadCountResponse> | UnreadCountResponse,
      ): number => {
        const unwrapped = unwrapEnvelope<UnreadCountResponse>(res);
        return typeof unwrapped?.count === 'number' ? unwrapped.count : 0;
      },
      providesTags: [{ type: 'Notification', id: 'UNREAD_COUNT' }],
    }),

    /**
     * PATCH /notifications/:id/read — mark a single notification as read.
     * Invalidates both the list cache and the unread-count cache so the
     * badge refreshes immediately.
     */
    markAsRead: builder.mutation<void, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      transformResponse: () => undefined,
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'UNREAD_COUNT' },
      ],
    }),

    /**
     * TODO(backend): expose a bulk endpoint such as
     *   POST /notifications/mark-all-read
     * and replace this `queryFn` with a single `query: () => ({ url, method })`.
     * For now we fan out the existing per-id PATCH against the cached list.
     */
    markAllAsRead: builder.mutation<void, void>({
      async queryFn(_arg, { dispatch }, _extra, fetchWithBQ) {
        const listResult = await dispatch(
          notificationsApi.endpoints.getNotifications.initiate(undefined, { forceRefetch: true }),
        )
          .unwrap()
          .catch(() => [] as Notification[]);

        const unreadIds = (listResult ?? []).filter((n) => !n.read).map((n) => n.id);

        for (const id of unreadIds) {
          const result = await fetchWithBQ({ url: `/notifications/${id}/read`, method: 'PATCH' });
          if (result.error) {
            return { error: result.error };
          }
        }
        return { data: undefined };
      },
      invalidatesTags: [
        { type: 'Notification', id: 'LIST' },
        { type: 'Notification', id: 'UNREAD_COUNT' },
      ],
    }),
  }),
});

// ────────────────────────────────────────────────────────────
// Public hooks (C7 task spec):
//   useGetNotificationsQuery, useGetUnreadCountQuery,
//   useMarkAsReadMutation,   useMarkAllAsReadMutation
//
// NOTE: the legacy hook names (useListNotificationsQuery,
// useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation)
// are still exported from `dashboard-api.ts` for backward compatibility
// with existing call sites in components/layout/{topbar,notifications-panel}.tsx.
// Both slices share the same `Notification` tag namespace so invalidations
// from the mutations below cascade correctly into the legacy cache.
// ────────────────────────────────────────────────────────────

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationsApi;
