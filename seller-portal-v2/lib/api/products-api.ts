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

/** One skipped/failed row in a bulk import. */
export interface ImportRowError {
  handle?: string;
  name?: string;
  stage?: string;
  message: string;
}
/** Live status of a bulk product-import job (GET /products/import/:jobId). */
export interface ImportJob {
  _id: string;
  status: 'processing' | 'completed' | 'failed';
  total: number;
  processed: number;
  created: number;
  failed: number;
  skipped: number;
  errors: ImportRowError[];
  filename?: string;
  createdAt?: string;
  updatedAt?: string;
  /** number of create-stage failures still available to retry (list view only) */
  retriableCount?: number;
  /** set when this job was created by retrying another job's failures */
  retryOf?: string;
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

/** A page of products plus the server's TRUE totals (from countDocuments). */
export interface ProductsPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query<Product[], ListProductsParams | void>({
      // Seller portal: hit the store-scoped `/products/mine` route. Scope is
      // enforced SERVER-SIDE from the X-Store-Id header (the active store the
      // seller is a verified member of) — NOT a client-supplied sellerId. This
      // is why switching the active store (which resets the RTK cache) refetches
      // the correct store's products, and why draft/archived stay private.
      query: (params) => {
        const p = params || {};
        return {
          url: '/products/mine',
          method: 'GET',
          params: {
            page: p.page,
            limit: p.limit,
            status: p.status,
            // Server-side names: `q` for free-text search, `category` for category id.
            q: p.search,
            category: p.categoryId,
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
     * Same `/products/mine` route as `listProducts`, but KEEPS the server's
     * pagination `meta` so the UI gets the TRUE total (a countDocuments) — not
     * just the length of the returned page. Powers the products table's pager and
     * the All/Active/Drafts/Archived tab counts, which must stay accurate beyond
     * the 100-row page cap.
     */
    listProductsPage: builder.query<ProductsPage, ListProductsParams | void>({
      query: (params) => {
        const p = params || {};
        return {
          url: '/products/mine',
          method: 'GET',
          params: {
            page: p.page,
            limit: p.limit,
            status: p.status,
            q: p.search,
            category: p.categoryId,
            sortBy: p.sortBy,
            sortOrder: p.sortOrder,
          },
        };
      },
      transformResponse: (
        res: ResponseEnvelope<Product[]> | { data: Product[]; meta?: Record<string, number> } | Product[],
      ): ProductsPage => {
        const u = unwrapEnvelope<any>(res as any);
        const rawItems: any[] = Array.isArray(u?.data) ? u.data : Array.isArray(u) ? u : [];
        const items = rawItems.map((p) => ({ ...p, id: p.id ?? p._id ?? '' })) as Product[];
        const meta = (u && typeof u === 'object' && u.meta) || {};
        const limit = meta.limit ?? (items.length || 1);
        const total = meta.total ?? items.length;
        return {
          items,
          total,
          page: meta.page ?? 1,
          limit,
          totalPages: meta.totalPages ?? Math.max(1, Math.ceil(total / limit)),
        };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Product', id: 'LIST' }, ...result.items.map((p) => ({ type: 'Product' as const, id: p.id }))]
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
      // The API serializes Mongo `_id` (not the `id` virtual), so map it → `id`.
      // Without this, `product.id` is undefined and saving PATCHes
      // /products/undefined → "Invalid ID format: undefined".
      transformResponse: (res: ResponseEnvelope<Product> | Product) => {
        const p = unwrapEnvelope<any>(res as any);
        return p && typeof p === 'object' ? ({ ...p, id: p.id ?? p._id ?? '' } as Product) : p;
      },
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
     * POST /products/bulk-update — store-scoped (@StoreScoped(STAFF)); updates
     * status/featured on many products of the active store at once.
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

    // Bulk import from a CSV/XLSX file — uploads the raw file (multipart); the
    // backend parses, rehosts images to R2, AI-drafts copy+category, creates each
    // product, and tracks progress. Returns a jobId to poll.
    importProducts: builder.mutation<{ jobId: string; total: number; skipped: number }, FormData>({
      query: (formData) => ({ url: '/products/import', method: 'POST', body: formData }),
      transformResponse: (
        res: ResponseEnvelope<{ jobId: string; total: number; skipped: number }> | { jobId: string; total: number; skipped: number },
      ) => unwrapEnvelope(res),
    }),

    // Poll bulk-import progress. Call the hook with { pollingInterval } and stop
    // (skip) once status is 'completed' | 'failed'.
    getImportJob: builder.query<ImportJob, string>({
      query: (jobId) => ({ url: `/products/import/${jobId}`, method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<ImportJob> | ImportJob) => unwrapEnvelope<ImportJob>(res),
      providesTags: (_r, _e, jobId) => [{ type: 'Import', id: jobId }],
    }),

    // Recent import jobs for the signed-in seller (history view).
    listImports: builder.query<ImportJob[], void>({
      query: () => ({ url: '/products/imports', method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<ImportJob[]> | ImportJob[]) => unwrapEnvelope<ImportJob[]>(res) ?? [],
      providesTags: [{ type: 'Import', id: 'LIST' }],
    }),

    // Re-run only the failed items of a prior import — returns a new jobId to poll.
    retryImport: builder.mutation<{ jobId: string; total: number }, string>({
      query: (jobId) => ({ url: `/products/import/${jobId}/retry`, method: 'POST' }),
      transformResponse: (res: ResponseEnvelope<{ jobId: string; total: number }> | { jobId: string; total: number }) => unwrapEnvelope(res),
      invalidatesTags: [{ type: 'Import', id: 'LIST' }, { type: 'Product', id: 'LIST' }],
    }),
  }),
});

export const {
  useListProductsQuery,
  useListProductsPageQuery,
  useGetProductQuery,
  useAiDraftProductMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useArchiveProductMutation,
  useBulkUpdateProductsMutation,
  useBulkCreateProductsMutation,
  useImportProductsMutation,
  useGetImportJobQuery,
  useListImportsQuery,
  useRetryImportMutation,
} = productsApi;
