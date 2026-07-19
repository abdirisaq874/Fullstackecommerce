/**
 * Orders RTK Query endpoint slice — wired to the real backend.
 *
 * Endpoint mapping:
 *   listOrders        → GET   /orders/seller           (seller's sales, paginated)
 *   getOrder          → GET   /orders/:id              (seller-scoped to their items)
 *   setOrderStatus    → PATCH /admin/orders/:id/status (admin-only)
 *   fulfillOrder      → PATCH /admin/orders/:id/status (admin-only; status='shipped')
 *
 * Seller scoping: `GET /orders/seller` returns orders that CONTAIN the current
 * seller's products (their sales), each reduced to just that seller's line items
 * — not orders the seller placed as a buyer (that's `GET /orders`).
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

// The backend order shape (_id, orderNumber, items[], shippingAddress, …) is not
// the flat shape the portal UI renders (id, customer, destination, items count,
// date, …). Map it here so every screen gets consistent, non-undefined fields —
// otherwise helpers like countryFlag(o.destination) crash on undefined.
const KNOWN_STATUSES: OrderStatus[] = [
  'new', 'confirmed', 'processing', 'picked', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded',
];
function mapStatus(s?: string): OrderStatus {
  if (s === 'pending') return 'new';
  return KNOWN_STATUSES.includes(s as OrderStatus) ? (s as OrderStatus) : 'new';
}
function mapOrder(raw: any): Order {
  const addr = raw?.shippingAddress ?? {};
  const items: any[] = Array.isArray(raw?.items) ? raw.items : [];
  const iso: string = raw?.placedAt || raw?.createdAt || '';
  return {
    id: String(raw?._id ?? raw?.id ?? ''),
    orderNumber: raw?.orderNumber ?? '',
    customer: addr.fullName || '—',
    customerEmail: raw?.customerEmail ?? '',
    customerPhone: addr.phone ?? '',
    destination: [addr.city, addr.countryCode].filter(Boolean).join(', ') || (addr.countryCode ?? ''),
    destinationFull: [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.countryCode].filter(Boolean).join(', '),
    total: raw?.total ?? 0,
    subtotal: raw?.subtotal ?? 0,
    shipping: raw?.shippingCost ?? 0,
    tax: raw?.taxAmount ?? 0,
    items: items.length,
    status: mapStatus(raw?.status),
    date: iso ? new Date(iso).toLocaleDateString() : '',
    placedAt: iso,
    paymentMethod: raw?.paymentMethod ?? '',
    carrier: raw?.carrier ?? '',
    trackingNumber: raw?.trackingNumber ?? '',
    itemsList: items.map((it) => ({
      productId: String(it?.productId ?? ''),
      name: it?.productName ?? it?.variantName ?? '',
      sku: it?.sku ?? it?.variantSku ?? '',
      quantity: it?.quantity ?? 0,
      price: it?.unitPrice ?? 0,
      initial: String(it?.productName ?? '?').charAt(0).toUpperCase(),
      imageUrl: it?.imageUrl,
    })),
    timeline: [],
  };
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listOrders: builder.query<Order[], ListOrdersParams | void>({
      // Seller-scoped: orders containing THIS seller's products (their sales),
      // not orders the seller placed as a buyer. Backend scopes each order to
      // the seller's own line items.
      query: (params) => ({
        url: '/orders/seller',
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
        const rows =
          unwrapped &&
          typeof unwrapped === 'object' &&
          Array.isArray((unwrapped as { data?: unknown }).data)
            ? (unwrapped as { data: any[] }).data
            : Array.isArray(unwrapped)
              ? (unwrapped as any[])
              : [];
        return rows.map(mapOrder);
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
      transformResponse: (r: ResponseEnvelope<Order> | Order) => {
        const raw = unwrapEnvelope<any>(r);
        return raw ? mapOrder(raw) : undefined;
      },
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
