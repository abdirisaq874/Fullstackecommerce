/**
 * Seller-finance RTK Query endpoint slice.
 *
 * Mirrors the NestJS `SellerFinanceController` (prefix `/seller/finance`):
 *   GET /seller/finance/balance         → BalanceSummary
 *   GET /seller/finance/transactions    → PaginatedResponse<FinanceTransaction>
 *   GET /seller/finance/payouts         → PaginatedResponse<FinancePayout>
 *   GET /seller/finance/payouts/:id     → FinancePayout
 *
 * Response shape:
 *   - All responses are wrapped by the NestJS `TransformInterceptor` envelope
 *     `{ success, data, ... }` — peeled per-endpoint via `unwrapEnvelope`.
 *   - List endpoints additionally return a `PaginatedResponseDto`
 *     (`{ data: T[], meta: { total, page, limit, totalPages, hasNext, hasPrev } }`).
 *     We surface the *whole* paginated payload so list pages can drive their
 *     pager from `meta.totalPages` / `meta.hasNext` without a second request.
 *
 * Money fields are integer cents (`availableCents`, `amountCents`, `feeCents`,
 * `netCents`) — the UI formats them via `formatCurrencyCents` from `lib/utils`.
 */
import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';

// ────────────────────────────────────────────────────────────
// Types (mirror the backend DTOs / schema shapes)
// ────────────────────────────────────────────────────────────

export interface BalanceSummary {
  availableCents: number;
  pendingCents: number;
  lifetimeNetCents: number;
  currency: string;
  /** ISO timestamp of the next scheduled payout (server-computed). */
  nextPayoutAt: string;
}

export type FinanceTransactionType = 'sale' | 'refund';

export interface FinanceTransaction {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  type: FinanceTransactionType;
  orderId: string;
  orderNumber?: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
}

export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface FinancePayout {
  /** Mongo doc id — exposed as both `_id` (mongoose default) and `id`. */
  id?: string;
  _id?: string;
  sellerId?: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  currency: string;
  status: PayoutStatus;
  stripePayoutId?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ListParams {
  page?: number;
  limit?: number;
}

// ────────────────────────────────────────────────────────────
// Endpoint slice
// ────────────────────────────────────────────────────────────

export const financeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBalance: builder.query<BalanceSummary, void>({
      query: () => ({ url: '/seller/finance/balance', method: 'GET' }),
      transformResponse: (r: ResponseEnvelope<BalanceSummary> | BalanceSummary) =>
        unwrapEnvelope<BalanceSummary>(r),
      providesTags: [{ type: 'Payout', id: 'BALANCE' }],
    }),

    listTransactions: builder.query<PaginatedResponse<FinanceTransaction>, ListParams | void>({
      query: (params) => ({
        url: '/seller/finance/transactions',
        method: 'GET',
        params: params ?? undefined,
      }),
      transformResponse: (
        r:
          | ResponseEnvelope<PaginatedResponse<FinanceTransaction>>
          | PaginatedResponse<FinanceTransaction>,
      ) => unwrapEnvelope<PaginatedResponse<FinanceTransaction>>(r),
      providesTags: [{ type: 'Payout', id: 'TX_LIST' }],
    }),

    listPayouts: builder.query<PaginatedResponse<FinancePayout>, ListParams | void>({
      query: (params) => ({
        url: '/seller/finance/payouts',
        method: 'GET',
        params: params ?? undefined,
      }),
      transformResponse: (
        r:
          | ResponseEnvelope<PaginatedResponse<FinancePayout>>
          | PaginatedResponse<FinancePayout>,
      ) => {
        const payload = unwrapEnvelope<PaginatedResponse<FinancePayout>>(r);
        // Normalise `_id` → `id` so downstream consumers can rely on `id`.
        return {
          ...payload,
          data: (payload.data ?? []).map((p) => ({ ...p, id: p.id ?? p._id })),
        };
      },
      providesTags: (result) =>
        result
          ? [
              { type: 'Payout' as const, id: 'LIST' },
              ...result.data.map((p) => ({ type: 'Payout' as const, id: p.id ?? p._id ?? 'unknown' })),
            ]
          : [{ type: 'Payout', id: 'LIST' }],
    }),

    getPayout: builder.query<FinancePayout, string>({
      query: (id) => ({ url: `/seller/finance/payouts/${id}`, method: 'GET' }),
      transformResponse: (r: ResponseEnvelope<FinancePayout> | FinancePayout) => {
        const p = unwrapEnvelope<FinancePayout>(r);
        return { ...p, id: p.id ?? p._id };
      },
      providesTags: (_, __, id) => [{ type: 'Payout', id }],
    }),
  }),
});

export const {
  useGetBalanceQuery,
  useListTransactionsQuery,
  useListPayoutsQuery,
  useGetPayoutQuery,
} = financeApi;
