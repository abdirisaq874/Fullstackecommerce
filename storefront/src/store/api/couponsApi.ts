import { apiSlice } from './apiSlice';
import type { Cart } from '@/types';

// NOTE: backed by customer coupon endpoints added in the backend-additions task
// (POST/DELETE /cart/coupon). The cart response then carries couponCode +
// discountAmount, which flows into the order at checkout.
export const couponsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    applyCoupon: builder.mutation<Cart, { code: string }>({
      query: (body) => ({ url: '/cart/coupon', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    removeCoupon: builder.mutation<Cart, void>({
      query: () => ({ url: '/cart/coupon', method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
  }),
});

export const { useApplyCouponMutation, useRemoveCouponMutation } = couponsApi;
