/**
 * Seller customers RTK Query slice — wired to backend module F2.
 *
 * Endpoint mapping:
 *   listCustomers → GET /seller/customers
 *       query params: page, limit, search, sortBy (lastOrderAt|lifetimeValue|orderCount),
 *                     sortDir (asc|desc)
 *       response:     { data: SellerCustomer[], meta: { total, page, limit, totalPages, hasNext, hasPrev } }
 *
 *   getCustomer   → GET /seller/customers/:userId
 *       response:     SellerCustomerDetail (includes orders[] scoped to this seller)
 *
 * NOTE: lifetimeValue / unitPrice / totalPrice come from the aggregation in
 * the backend in the same currency as the order documents themselves
 * (`Order.currency` per row). The list view aggregates across orders without
 * currency normalisation — the figure is treated as a single major-unit total
 * for display. If/when multi-currency support is needed, the backend will
 * need to return per-currency breakdowns and this slice will follow.
 */
import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';

export type CustomerSortField = 'lastOrderAt' | 'lifetimeValue' | 'orderCount';
export type SortDirection = 'asc' | 'desc';

export interface SellerCustomer {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
}

export interface SellerCustomerOrderItem {
  productId: string;
  productName: string;
  variantSku: string;
  variantName: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SellerCustomerOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  placedAt: string | null;
  createdAt: string;
  currency: string;
  sellerSubtotal: number;
  sellerItemCount: number;
  items: SellerCustomerOrderItem[];
}

export interface SellerCustomerDetail extends SellerCustomer {
  orders: SellerCustomerOrder[];
}

export interface CustomersPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListCustomersResult {
  data: SellerCustomer[];
  meta: CustomersPageMeta;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: CustomerSortField;
  sortDir?: SortDirection;
}

/**
 * Shape returned by the backend list endpoint: `{ data, meta }` wrapped in
 * the standard TransformInterceptor envelope.
 */
interface BackendListPayload {
  data: SellerCustomer[];
  meta: CustomersPageMeta;
}

const EMPTY_META: CustomersPageMeta = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

export const customersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCustomers: builder.query<ListCustomersResult, ListCustomersParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/seller/customers',
          method: 'GET',
          params: {
            page: p.page,
            limit: p.limit,
            search: p.search?.trim() ? p.search.trim() : undefined,
            sortBy: p.sortBy,
            sortDir: p.sortDir,
          },
        };
      },
      transformResponse: (
        res: ResponseEnvelope<BackendListPayload> | BackendListPayload,
      ): ListCustomersResult => {
        const unwrapped = unwrapEnvelope<BackendListPayload>(
          res as ResponseEnvelope<BackendListPayload> | BackendListPayload,
        );
        // Defensive: in case the shape changes we still return something usable.
        if (!unwrapped || !Array.isArray(unwrapped.data)) {
          return { data: [], meta: { ...EMPTY_META } };
        }
        return {
          data: unwrapped.data,
          meta: unwrapped.meta ?? { ...EMPTY_META },
        };
      },
      providesTags: (result) =>
        result
          ? [
              { type: 'Customer', id: 'LIST' },
              ...result.data.map((c) => ({ type: 'Customer' as const, id: c.userId })),
            ]
          : [{ type: 'Customer', id: 'LIST' }],
    }),

    getCustomer: builder.query<SellerCustomerDetail, string>({
      query: (userId) => ({
        url: `/seller/customers/${userId}`,
        method: 'GET',
      }),
      transformResponse: (
        res: ResponseEnvelope<SellerCustomerDetail> | SellerCustomerDetail,
      ) => unwrapEnvelope<SellerCustomerDetail>(res),
      providesTags: (_, __, userId) => [{ type: 'Customer', id: userId }],
    }),
  }),
});

export const { useListCustomersQuery, useGetCustomerQuery } = customersApi;
