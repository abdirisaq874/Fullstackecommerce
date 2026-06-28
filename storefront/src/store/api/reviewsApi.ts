import { apiSlice } from './apiSlice';
import type { Paginated, Review } from '@/types';

// NOTE: backed by reviews endpoints added in the backend-additions task.
// Falls back gracefully (empty list) if the endpoint is not yet deployed.
export const reviewsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listReviews: builder.query<Paginated<Review>, { productId: string; page?: number }>({
      query: ({ productId, page = 1 }) => `/products/${productId}/reviews?page=${page}&limit=10`,
      providesTags: (_r, _e, a) => [{ type: 'Reviews', id: a.productId }],
    }),
    createReview: builder.mutation<Review, { productId: string; rating: number; title?: string; body?: string }>({
      query: ({ productId, ...body }) => ({ url: `/products/${productId}/reviews`, method: 'POST', body }),
      invalidatesTags: (_r, _e, a) => [{ type: 'Reviews', id: a.productId }, { type: 'Product', id: a.productId }],
    }),
  }),
});

export const { useListReviewsQuery, useCreateReviewMutation } = reviewsApi;
