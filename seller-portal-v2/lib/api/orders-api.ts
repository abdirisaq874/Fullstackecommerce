/**
 * Orders RTK Query endpoint slice — wired to the real backend.
 *
 * Endpoint mapping:
 *   listOrders        → GET   /orders                  (paginated, auth required)
 *   getOrder          → GET   /orders/:id
 *   setOrderStatus    → PATCH /admin/orders/:id/status (admin-only)
 *   fulfillOrder      → PATCH /admin/orders/:id/status (admin-only; status='shipped')
 *
 * NOTE (seller scoping): `GET /orders` currently returns orders for the
 * *authenticated user* (`OrderController.findMyOrders` calls
 * `orderService.findByUser`). A true seller-scoped view (orders that contain
 * items from the seller's catalogue) is not yet implemented on the backend.
 * TODO(backend): add a seller-scoped endpoint (e.g. `GET /seller/orders`) that
 * filters orders to those containing items belonging to the current seller.
 *
 * TODO(backend): `fulfillOrder` reuses `PATCH /admin/orders/:id/status` with
 * `status='shipped'`. The carrier / trackingNumber / weightKg fields are NOT
 * persisted by that endpoint today — a dedicated fulfilment endpoint (or a
 * richer body for the status update) is needed to record those fields.
 */
import { baseApi } from './base-api';
import { unwrapEnvelope } from './base-api';
import type { ResponseEnvelope } from './base-api';
import type { Order, OrderStatus } from '@/lib/types';

interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listOrders: builder.query<Order[], ListOrdersParams | void>({
      query: (params) => ({
        url: '/orders',
        method: 'GET',
        params: params ?? undefined,
      }),
      transformResponse: (
        r:
          | ResponseEnvelope<{ data: Order[] } | Order[]>
          | { data: Order[] }
          | Order[],
      ): Order[] => {
        // Backend `/orders` paginates: TransformInterceptor envelope wraps an
        // inner `{ data: [...], meta }`. Pull `.data` off the inner shape.
        const unwrapped = unwrapEnvelope<{ data: Order[] } | Order[]>(r);
        if (
          unwrapped &&
          typeof unwrapped === 'object' &&
          Array.isArray((unwrapped as { data?: unknown }).data)
        ) {
          return (unwrapped as { data: Order[] }).data;
        }
        return Array.isArray(unwrapped) ? unwrapped : [];
      },
      providesTags: (result) =>
        Array.isArray(result)
          ? [{ type: 'Order', id: 'LIST' }, ...result.map(o => ({ type: 'Order' as const, id: o.id }))]
          : [{ type: 'Order', id: 'LIST' }],
    }),

    getOrder: builder.query<Order | undefined, string>({
      query: (id) => ({
        url: `/orders/${id}`,
        method: 'GET',
      }),
      transformResponse: (r: ResponseEnvelope<Order> | Order) =>
        unwrapEnvelope<Order>(r),
      providesTags: (_, __, id) => [{ type: 'Order', id }],
    }),

    setOrderStatus: builder.mutation<Order, { id: string; status: OrderStatus; reason?: string }>({
      query: ({ id, status, reason }) => ({
        url: `/admin/orders/${id}/status`,
        method: 'PATCH',
        body: { status, reason },
      }),
      transformResponse: (r: ResponseEnvelope<Order> | Order) =>
        unwrapEnvelope<Order>(r),
      invalidatesTags: (_, __, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        { type: 'Dashboard', id: 'METRICS' },
      ],
    }),

    // TODO(backend): point at a dedicated fulfilment endpoint that persists
    // `carrier`, `trackingNumber`, and `weightKg`. For now we reuse the admin
    // status endpoint to mark the order as shipped — extra fields are dropped
    // server-side until the endpoint exists.
    fulfillOrder: builder.mutation<Order, { id: string; carrier: string; trackingNumber: string; weightKg?: number }>({
      query: ({ id }) => ({
        url: `/admin/orders/${id}/status`,
        method: 'PATCH',
        body: { status: 'shipped' },
      }),
      transformResponse: (r: ResponseEnvelope<Order> | Order) =>
        unwrapEnvelope<Order>(r),
      invalidatesTags: (_, __, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        { type: 'Dashboard', id: 'METRICS' },
      ],
    }),
  }),
});

export const {
  useListOrdersQuery,
  useGetOrderQuery,
  useSetOrderStatusMutation,
  useFulfillOrderMutation,
} = ordersApi;
