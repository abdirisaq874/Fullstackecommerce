import { baseApi, delay } from './base-api';
import { db } from './mock-db';
import { cap } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listOrders: builder.query<Order[], void>({
      async queryFn() {
        await delay(180);
        return { data: db.orders };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Order', id: 'LIST' }, ...result.map(o => ({ type: 'Order' as const, id: o.id }))]
          : [{ type: 'Order', id: 'LIST' }],
    }),

    getOrder: builder.query<Order | undefined, string>({
      async queryFn(id) {
        await delay(140);
        return { data: db.orders.find(o => o.id === id) };
      },
      providesTags: (_, __, id) => [{ type: 'Order', id }],
    }),

    setOrderStatus: builder.mutation<Order, { id: string; status: OrderStatus }>({
      async queryFn({ id, status }) {
        await delay(220);
        const idx = db.orders.findIndex(o => o.id === id);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const order = db.orders[idx];
        const updated: Order = {
          ...order,
          status,
          timeline: [...(order.timeline || []), { event: `Status changed to ${cap(status)}`, date: 'Just now' }],
        };
        db.orders[idx] = updated;
        return { data: updated };
      },
      invalidatesTags: (_, __, { id }) => [{ type: 'Order', id }, { type: 'Order', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),

    fulfillOrder: builder.mutation<Order, { id: string; carrier: string; trackingNumber: string; weightKg?: number }>({
      async queryFn({ id, carrier, trackingNumber }) {
        await delay(450);
        const idx = db.orders.findIndex(o => o.id === id);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const order = db.orders[idx];
        const updated: Order = {
          ...order, status: 'shipped', carrier, trackingNumber,
          timeline: [...(order.timeline || []), { event: `Shipped via ${carrier} · ${trackingNumber}`, date: 'Just now' }],
        };
        db.orders[idx] = updated;
        return { data: updated };
      },
      invalidatesTags: (_, __, { id }) => [{ type: 'Order', id }, { type: 'Order', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),
  }),
});

export const {
  useListOrdersQuery,
  useGetOrderQuery,
  useSetOrderStatusMutation,
  useFulfillOrderMutation,
} = ordersApi;
