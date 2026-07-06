import { apiSlice } from './apiSlice';
import type { Product, Paginated } from '@/types';

export interface SellerProfile {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  country: string | null;
  productCount: number;
  avgRating: number;
  reviewCount: number;
  memberSince?: string;
}

/** Public seller storefronts (see backend `sellers` module). */
export const sellersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    seller: builder.query<SellerProfile, string>({
      query: (idOrSlug) => `/sellers/${idOrSlug}`,
    }),
    sellerProducts: builder.query<Paginated<Product>, { id: string; page?: number; limit?: number; sortBy?: string }>({
      query: ({ id, page = 1, limit = 24, sortBy }) =>
        `/sellers/${id}/products?page=${page}&limit=${limit}${sortBy ? `&sortBy=${sortBy}` : ''}`,
    }),
  }),
});

export const { useSellerQuery, useSellerProductsQuery } = sellersApi;
