/**
 * Categories & brands — read from the real backend (GET /categories, /brands)
 * instead of the hard-coded `reference-data` placeholders. The product form's
 * dropdowns and the product list's name lookups use these so a real Mongo
 * ObjectId is sent on create/update and the names resolve from live data.
 */
import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  children?: Category[];
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
}

function asArray<T>(res: ResponseEnvelope<T[]> | { data: T[] } | T[]): T[] {
  const unwrapped = unwrapEnvelope<unknown>(res as never);
  if (Array.isArray(unwrapped)) return unwrapped as T[];
  if (unwrapped && typeof unwrapped === 'object' && Array.isArray((unwrapped as { data?: unknown }).data)) {
    return (unwrapped as { data: T[] }).data;
  }
  return [];
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query<Category[], void>({
      query: () => ({ url: '/categories', method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<Category[]> | Category[]) => asArray<Category>(res),
    }),
    getBrands: builder.query<Brand[], void>({
      query: () => ({ url: '/brands', method: 'GET' }),
      transformResponse: (res: ResponseEnvelope<Brand[]> | Brand[]) => asArray<Brand>(res),
    }),
  }),
});

export const { useGetCategoriesQuery, useGetBrandsQuery } = catalogApi;