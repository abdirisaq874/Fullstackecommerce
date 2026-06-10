/**
 * Returns RTK Query endpoint slice for seller-portal-v2.
 *
 * Mirrors the NestJS `ReturnsController` seller-scoped endpoints:
 *   GET    /returns               (paginated, seller-scoped; optional ?status)
 *   GET    /returns/:id
 *   PATCH  /returns/:id/status     body: { status, notes? }
 *   PATCH  /returns/:id/inspection body: { refundDecision }
 *
 * Response envelope ({ success, data, ... }) is stripped per-endpoint via
 * `unwrapEnvelope`. The list endpoint additionally unwraps the inner
 * `PaginatedResponseDto` (`{ data, meta }`) to a plain `Return[]` so existing
 * hook consumers keep working unchanged.
 *
 * NOTE: the backend's `ReturnRequest` schema (Mongo) and the frontend's
 * legacy `Return` type differ on field names / structure. We keep the public
 * hook return type as `Return` for now to preserve the consumer contract;
 * a follow-up can introduce the schema-accurate type once UI is ready
 * to migrate.
 */
import { baseApi, unwrapEnvelope } from './base-api';
import type { ResponseEnvelope } from './base-api';
import type { Return, ReturnStatus, RefundDecision } from '@/lib/types';

// --- pagination shape (mirrors backend PaginatedResponseDto) ----------------

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// --- mutation body shapes ---------------------------------------------------

/**
 * PATCH /returns/:id/inspection body — `refundDecision` is the nested DTO
 * accepted by the backend `RecordInspectionDto`. We forward the optional
 * frontend `decision` enum so existing call-sites continue to work; consumers
 * can also pass any of the schema-accurate refund-decision fields directly.
 */
interface RecordInspectionBody {
  refundDecision: {
    type?: RefundDecision;
    refundAmountCents?: number;
    restockable?: boolean;
    inspectionNotes?: string;
  };
}

export const returnsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listReturns: builder.query<Return[], void>({
      query: () => ({
        url: '/returns',
        method: 'GET',
      }),
      transformResponse: (
        r: ResponseEnvelope<PaginatedResponse<Return>> | PaginatedResponse<Return>,
      ) => unwrapEnvelope<PaginatedResponse<Return>>(r).data,
      providesTags: (result) =>
        result
          ? [{ type: 'Return', id: 'LIST' }, ...result.map(r => ({ type: 'Return' as const, id: r.id }))]
          : [{ type: 'Return', id: 'LIST' }],
    }),

    getReturn: builder.query<Return | undefined, string>({
      query: (id) => ({
        url: `/returns/${id}`,
        method: 'GET',
      }),
      transformResponse: (r: ResponseEnvelope<Return> | Return) =>
        unwrapEnvelope<Return>(r),
      providesTags: (_, __, id) => [{ type: 'Return', id }],
    }),

    setReturnStatus: builder.mutation<Return, { id: string; status: ReturnStatus; notes?: string; decision?: RefundDecision; refundAmount?: number }>({
      query: ({ id, status, notes }) => ({
        url: `/returns/${id}/status`,
        method: 'PATCH',
        body: { status, ...(notes !== undefined ? { notes } : {}) },
      }),
      transformResponse: (r: ResponseEnvelope<Return> | Return) =>
        unwrapEnvelope<Return>(r),
      invalidatesTags: (_, __, { id }) => [{ type: 'Return', id }, { type: 'Return', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),

    recordInspection: builder.mutation<Return, { id: string; refundDecision: RecordInspectionBody['refundDecision'] }>({
      query: ({ id, refundDecision }) => ({
        url: `/returns/${id}/inspection`,
        method: 'PATCH',
        body: { refundDecision },
      }),
      transformResponse: (r: ResponseEnvelope<Return> | Return) =>
        unwrapEnvelope<Return>(r),
      invalidatesTags: (_, __, { id }) => [{ type: 'Return', id }, { type: 'Return', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),
  }),
});

export const {
  useListReturnsQuery,
  useGetReturnQuery,
  useSetReturnStatusMutation,
  useRecordInspectionMutation,
} = returnsApi;
