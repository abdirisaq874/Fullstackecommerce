import { apiSlice } from './apiSlice';
import type { ShippingRate } from '@/types';

interface QuoteBody {
  destinationCountry: string;
  items: { sku: string; qty: number; weightGrams?: number }[];
}

export const shippingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    shippingQuote: builder.mutation<{ rates: ShippingRate[] }, QuoteBody>({
      query: (body) => ({ url: '/shipping/quote', method: 'POST', body }),
    }),
  }),
});

export const { useShippingQuoteMutation } = shippingApi;
