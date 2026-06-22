import { baseApi, delay } from './base-api';
import { db } from './mock-db';
import type { Return, ReturnStatus, RefundDecision } from '@/lib/types';

export const returnsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listReturns: builder.query<Return[], void>({
      async queryFn() {
        await delay(180);
        return { data: db.returns };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Return', id: 'LIST' }, ...result.map(r => ({ type: 'Return' as const, id: r.id }))]
          : [{ type: 'Return', id: 'LIST' }],
    }),

    getReturn: builder.query<Return | undefined, string>({
      async queryFn(id) {
        await delay(140);
        return { data: db.returns.find(r => r.id === id) };
      },
      providesTags: (_, __, id) => [{ type: 'Return', id }],
    }),

    setReturnStatus: builder.mutation<Return, { id: string; status: ReturnStatus; decision?: RefundDecision; refundAmount?: number }>({
      async queryFn({ id, status, decision, refundAmount }) {
        await delay(250);
        const idx = db.returns.findIndex(r => r.id === id);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const r = db.returns[idx];
        const updated: Return = {
          ...r, status,
          ...(decision ? { decision } : {}),
          ...(refundAmount !== undefined ? { refundAmount } : {}),
          ...(status === 'received'  ? { receivedAt: 'Just now' } : {}),
          ...(status === 'refunded'  ? { refundedAt: 'Just now' } : {}),
        };
        // New array, not in-place — the cached array is frozen by RTK/Immer.
        db.returns = db.returns.map((x, i) => (i === idx ? updated : x));
        return { data: updated };
      },
      invalidatesTags: (_, __, { id }) => [{ type: 'Return', id }, { type: 'Return', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),
  }),
});

export const {
  useListReturnsQuery,
  useGetReturnQuery,
  useSetReturnStatusMutation,
} = returnsApi;
