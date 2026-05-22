// Base RTK Query API.
//
// In production this would use `fetchBaseQuery({ baseUrl: process.env.API_URL })`
// pointed at your NestJS backend. For this scaffold, we use `fakeBaseQuery`
// and `queryFn` on each endpoint, talking to the in-memory mock db.
//
// To swap to real backend:
//   1. Replace `fakeBaseQuery()` with `fetchBaseQuery({ baseUrl: '/api' })`
//   2. Replace `queryFn` blocks in each slice with `query` definitions
//   3. The cache-tag invalidation logic stays exactly the same

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    'Product', 'Order', 'Inventory', 'Return',
    'Message', 'Notification', 'Dashboard', 'Customer',
  ],
  endpoints: () => ({}),
  // Refetch on focus is a nice production touch — uncomment when wiring real API
  // refetchOnFocus: true,
  // refetchOnReconnect: true,
});

/** Simulate network latency for realistic loading states */
export const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms));
