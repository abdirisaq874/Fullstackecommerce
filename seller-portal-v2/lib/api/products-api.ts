import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';
import type { Product, CreateProductDto } from '@/lib/types';

/**
 * Query params accepted by GET /products (see backend `ProductQueryDto`).
 *
 * NOTE: the backend uses `q`, `category`, `brand` for search/filtering — the
 * frontend convenience aliases below (`search`, `categoryId`, `sellerId`) are
 * mapped to those server-side names inside the `query` builder.
 */
/** Payload for POST /products/ai/draft (seller AI assist). */
export interface AiDraftInput {
  name: string;
  brief?: string;
  brand?: string;
  attributes?: { key: string; value: string }[];
  imageUrl?: string;
}
/** What the AI returns: copy + a system-assigned category. */
export interface AiDraftResult {
  shortDescription: string;
  description: string;
  tags: string[];
  keywords: string[];
  categoryId: string | null;
  categoryPath: string;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  status?: 'draft' | 'active' | 'archived';
  search?: string;
  categoryId?: string;
  sellerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query<Product[], ListProductsParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/products',
          method: 'GET',
          params: {
            page: p.page,
            limit: p.limit,
            status: p.status,
            // Server-side names: `q` for free-text search, `category` for category id.
            q: p.search,
            category: p.categoryId,
            sellerId: p.sellerId,
            sortBy: p.sortBy,
            sortOrder: p.sortOrder,
          },
        };
      },
      transformResponse: (res: ResponseEnvelope<Product[]> | { data: Product[] } | Product[]) => {
        // Paginated list responses come through as `{ data: [...], meta: {...} }`
        // wrapped in the envelope; unwrap once to get the paginated payload,
        // then peel off `.data` if it's the paginated shape.
        const unwrapped = unwrapEnvelope<any>(res as any);
        if (unwrapped && typeof unwrapped === 'object' && Array.isArray(unwrapped.data)) {
          return unwrapped.data as Product[];
        }
        return (unwrapped as Product[]) ?? [];
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Product', id: 'LIST' }, ...result.map(p => ({ type: 'Product' as const, id: p.id }))]
          : [{ type: 'Product', id: 'LIST' }],
    }),

    /**
     * Backend exposes GET /products/:slug (lookup by slug, not id). Existing
     * callers pass the product slug as the parameter — if they pass an id we
     * fall through to the same endpoint, which will 404 cleanly.
     */
    getProduct: builder.query<Product | undefined, string>({
      query: (slug) => ({
        url: `/products/${slug}`,
        method: 'GET',
      }),
      transformResponse: (res: ResponseEnvelope<Product> | Product) => unwrapEnvelope<Product>(res),
      providesTags: (_, __, id) => [{ type: 'Product', id }],
    }),

    /** AI: generate copy + tags/keywords and auto-assign a category (system-owned). */
    aiDraftProduct: builder.mutation<AiDraftResult, AiDraftInput>({
      query: (body) => ({
        url: '/products/ai/draft',
        method: 'POST',
        body,
      }),
      transformResponse: (res: ResponseEnvelope<AiDraftResult> | AiDraftResult) =>
        unwrapEnvelope<AiDraftResult>(res),
    }),

    createProduct: builder.mutation<Product, CreateProductDto & { dimensions?: any[]; hasVariants?: boolean; stockOnHand?: any }>({
      query: (body) => ({
        url: '/products',
        method: 'POST',
        body,
      }),
      transformResponse: (res: ResponseEnvelope<Product> | Product) => unwrapEnvelope<Product>(res),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, { type: 'Inventory', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),

    updateProduct: builder.mutation<Product, { id: string; patch: Partial<CreateProductDto> & { variants?: any[] } }>({
      query: ({ id, patch }) => ({
        url: `/products/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      transformResponse: (res: ResponseEnvelope<Product> | Product) => unwrapEnvelope<Product>(res),
      invalidatesTags: (_, __, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
      ],
    }),

    /** Backend DELETE /products/:id is a soft-archive (sets status='archived'). */
    archiveProduct: builder.mutation<void, string>({
      query: (id) => ({
        url: `/products/${id}`,
        method: 'DELETE',
      }),
      transformResponse: () => undefined,
      invalidatesTags: (_, __, id) => [{ type: 'Product', id }, { type: 'Product', id: 'LIST' }],
    }),

    /**
     * TODO(backend): there is no bulk-update endpoint on the products controller
     * yet. Until one exists, calls to this hook will hit POST /products/bulk-update
     * and fail with 404. Tracked separately from C1 — keep the hook so consumers
     * still type-check, but the request is intentionally non-functional.
     */
    bulkUpdateProducts: builder.mutation<void, { ids: string[]; patch: Partial<Product> }>({
      query: ({ ids, patch }) => ({
        url: '/products/bulk-update',
        method: 'POST',
        body: { ids, patch },
      }),
      transformResponse: () => undefined,
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),

    // Bulk create (CSV import) — one request for many products, so a large import
    // stays under the global per-minute rate limit instead of one request per row.
    bulkCreateProducts: builder.mutation<{ created: number; failed: number }, { products: unknown[] }>({
      query: (body) => ({
        url: '/products/bulk-create',
        method: 'POST',
        body,
      }),
      transformResponse: (res: ResponseEnvelope<{ created: number; failed: number }> | { created: number; failed: number }) =>
        unwrapEnvelope(res),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, { type: 'Inventory', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),
  }),
});

export const {
  useListProductsQuery,
  useGetProductQuery,
  useAiDraftProductMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useArchiveProductMutation,
  useBulkUpdateProductsMutation,
  useBulkCreateProductsMutation,
} = productsApi;
