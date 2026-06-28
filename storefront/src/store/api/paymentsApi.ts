import { apiSlice } from './apiSlice';

export const paymentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createPaymentIntent: builder.mutation<{ clientSecret: string; paymentId: string }, { orderId: string }>({
      query: (body) => ({ url: '/payments/create-intent', method: 'POST', body }),
    }),
  }),
});

export const { useCreatePaymentIntentMutation } = paymentsApi;
