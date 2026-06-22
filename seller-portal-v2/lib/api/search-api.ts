/**
 * Search RTK Query endpoint slice for seller-portal-v2.
 *
 * Mirrors the NestJS `SearchController`:
 *   GET /search?q=...&type=...&limit=...
 *
 * Used by the global command palette (Cmd/Ctrl+K) to cross-search products,
 * orders, and message threads owned by the current seller. The response is
 * intentionally thin — just `{ type, id, title, subtitle?, url }` per hit —
 * so the palette can render any result type with a single component.
 *
 * Both `useSearchQuery` (auto-fetching) and `useLazySearchQuery` (manual
 * trigger, used by the palette's debounced input) are exported.
 */
import { baseApi, unwrapEnvelope } from './base-api';
import type { ResponseEnvelope } from './base-api';

// --- domain types -----------------------------------------------------------

export type SearchEntityType = 'product' | 'order' | 'message';
export type SearchType = 'all' | SearchEntityType;

export interface SearchResult {
  type: SearchEntityType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

// --- request param shape ----------------------------------------------------

export interface SearchParams {
  q: string;
  type?: SearchType;
  limit?: number;
}

// --- endpoint slice ---------------------------------------------------------

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    search: builder.query<SearchResponse, SearchParams>({
      query: ({ q, type, limit }) => ({
        url: '/search',
        method: 'GET',
        params: {
          q,
          ...(type ? { type } : {}),
          ...(limit !== undefined ? { limit } : {}),
        },
      }),
      transformResponse: (res: ResponseEnvelope<SearchResponse> | SearchResponse) =>
        unwrapEnvelope<SearchResponse>(res) ?? { results: [] },
    }),
  }),
});

export const { useSearchQuery, useLazySearchQuery } = searchApi;
