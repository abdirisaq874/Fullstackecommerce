import { apiSlice } from './apiSlice';
import { toQuery } from '@/lib/utils';
import type {
  Product, Category, Brand, Paginated, SmartSearchResponse,
} from '@/types';

export interface ProductListParams {
  q?: string;
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  inStock?: boolean;
  featured?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SmartSearchParams {
  q?: string;
  locale?: string;
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  sort?: string;
  attr?: string[];
  page?: number;
  limit?: number;
}

export const productsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query<Paginated<Product>, ProductListParams>({
      query: (params) => `/products?${toQuery(params as Record<string, unknown>)}`,
      providesTags: [{ type: 'Products', id: 'LIST' }],
    }),
    featuredProducts: builder.query<Product[], number | void>({
      query: (limit = 12) => `/products/featured?limit=${limit}`,
      providesTags: [{ type: 'Products', id: 'FEATURED' }],
    }),
    productBySlug: builder.query<Product, string>({
      query: (slug) => `/products/${slug}`,
      providesTags: (r) => (r ? [{ type: 'Product', id: r._id }] : []),
    }),
    smartSearch: builder.query<SmartSearchResponse, SmartSearchParams>({
      query: ({ attr, ...rest }) => {
        const base = toQuery(rest as Record<string, unknown>);
        const attrs = (attr ?? []).map((a) => `attr=${encodeURIComponent(a)}`).join('&');
        return `/catalog/search?${[base, attrs].filter(Boolean).join('&')}`;
      },
      providesTags: [{ type: 'Products', id: 'SEARCH' }],
    }),
    categoryTree: builder.query<Category[], void>({
      query: () => '/categories',
      providesTags: ['Categories'],
    }),
    brands: builder.query<Brand[], void>({
      query: () => '/brands',
      providesTags: ['Brands'],
    }),
  }),
});

export const {
  useListProductsQuery,
  useFeaturedProductsQuery,
  useProductBySlugQuery,
  useSmartSearchQuery,
  useLazySmartSearchQuery,
  useCategoryTreeQuery,
  useBrandsQuery,
} = productsApi;
