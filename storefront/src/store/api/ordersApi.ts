import { apiSlice } from './apiSlice';
import { toQuery } from '@/lib/utils';
import type { Address, Order, Paginated } from '@/types';

interface CreateOrderBody {
  shippingAddress: Address;
  billingAddress?: Address;
  notes?: string;
}

export const ordersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createOrder: builder.mutation<Order, CreateOrderBody>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Order', 'Cart'],
    }),
    listOrders: builder.query<Paginated<Order>, { page?: number; limit?: number }>({
      query: (params) => `/orders?${toQuery(params as Record<string, unknown>)}`,
      providesTags: ['Order'],
    }),
    getOrder: builder.query<Order, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Order', id }],
    }),
    cancelOrder: builder.mutation<Order, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({ url: `/orders/${id}/cancel`, method: 'PATCH', body: { reason } }),
      invalidatesTags: (_r, _e, a) => [{ type: 'Order', id: a.id }, 'Order'],
    }),
  }),
});

export const {
  useCreateOrderMutation,
  useListOrdersQuery,
  useGetOrderQuery,
  useCancelOrderMutation,
} = ordersApi;
