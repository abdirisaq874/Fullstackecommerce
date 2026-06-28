import { apiSlice } from './apiSlice';

export interface StockInfo {
  sku: string;
  available?: number;
  inStock?: boolean;
}

export const inventoryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    checkStock: builder.query<StockInfo, string>({
      query: (sku) => `/inventory/check/${sku}`,
    }),
  }),
});

export const { useCheckStockQuery } = inventoryApi;
