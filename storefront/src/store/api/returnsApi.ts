import { apiSlice } from './apiSlice';
import { toQuery } from '@/lib/utils';
import type { Paginated, ReturnRequest } from '@/types';

export const returnsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listReturns: builder.query<Paginated<ReturnRequest>, { page?: number }>({
      query: (params) => `/returns/me?${toQuery(params as Record<string, unknown>)}`,
      providesTags: ['Returns'],
    }),
    createReturn: builder.mutation<ReturnRequest, { orderId: string; items: { sku: string; qty: number; reason: string }[] }>({
      query: (body) => ({ url: '/returns', method: 'POST', body }),
      invalidatesTags: ['Returns'],
    }),
  }),
});

export const { useListReturnsQuery, useCreateReturnMutation } = returnsApi;
