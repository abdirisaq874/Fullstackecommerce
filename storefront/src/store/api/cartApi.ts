import { apiSlice } from './apiSlice';
import type { Cart } from '@/types';

interface AddItemBody { productId: string; variantSku?: string; quantity: number }

export const cartApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCart: builder.query<Cart, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),
    addToCart: builder.mutation<Cart, AddItemBody>({
      query: (body) => ({ url: '/cart/items', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    updateCartItem: builder.mutation<Cart, { sku: string; quantity: number }>({
      query: ({ sku, quantity }) => ({ url: `/cart/items/${sku}`, method: 'PATCH', body: { quantity } }),
      invalidatesTags: ['Cart'],
    }),
    removeCartItem: builder.mutation<Cart, string>({
      query: (sku) => ({ url: `/cart/items/${sku}`, method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    clearCart: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/cart', method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
  }),
});

export const {
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
} = cartApi;
