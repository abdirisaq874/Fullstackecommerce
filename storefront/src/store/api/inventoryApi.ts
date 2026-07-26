import { apiSlice } from './apiSlice';

export interface StockInfo {
  sku: string;
  available?: number;
  inStock?: boolean;
}

export interface StockLevel {
  variantSku: string;
  quantity?: number;
  reserved?: number;
}

export const inventoryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    checkStock: builder.query<StockInfo, string>({
      query: (sku) => `/inventory/check/${sku}`,
    }),
    // Per-SKU stock levels for a whole product → lets the PDP show real
    // per-variant availability (incl. 0) and distinguish untracked SKUs.
    getStockLevels: builder.query<StockLevel[], string>({
      query: (productId) => `/inventory/public/product/${productId}`,
    }),
  }),
});

export const { useCheckStockQuery, useGetStockLevelsQuery } = inventoryApi;
