import { apiSlice } from './apiSlice';
import type { Product } from '@/types';

/**
 * Product recommendations (see backend `recommendations` module):
 *  - related: semantically similar items (vector k-NN)
 *  - frequentlyBoughtTogether: order co-purchase
 *  - forYou: personalized from recently-viewed + trending
 */
export const recommendationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    relatedProducts: builder.query<Product[], { productId: string; limit?: number }>({
      query: ({ productId, limit = 8 }) => `/recommendations/related/${productId}?limit=${limit}`,
    }),
    frequentlyBoughtTogether: builder.query<Product[], { productId: string; limit?: number }>({
      query: ({ productId, limit = 6 }) =>
        `/recommendations/frequently-bought-together/${productId}?limit=${limit}`,
    }),
    forYou: builder.query<Product[], { viewed?: string[]; limit?: number }>({
      query: ({ viewed = [], limit = 12 }) => {
        const v = viewed.filter(Boolean).join(',');
        return `/recommendations/for-you?limit=${limit}${v ? `&viewed=${v}` : ''}`;
      },
    }),
  }),
});

export const {
  useRelatedProductsQuery,
  useFrequentlyBoughtTogetherQuery,
  useForYouQuery,
} = recommendationsApi;
