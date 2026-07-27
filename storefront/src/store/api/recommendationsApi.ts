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
    // Record a behavioural signal. The backend only persists it for logged-in
    // users (it needs the auth token), so callers should gate on being signed in.
    trackInteraction: builder.mutation<{ ok: boolean }, { productId: string; type: 'view' | 'cart' | 'purchase' }>({
      query: (body) => ({ url: '/recommendations/track', method: 'POST', body }),
    }),
  }),
});

export const {
  useRelatedProductsQuery,
  useFrequentlyBoughtTogetherQuery,
  useForYouQuery,
  useTrackInteractionMutation,
} = recommendationsApi;
