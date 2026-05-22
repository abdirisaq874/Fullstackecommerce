import { baseApi, delay } from './base-api';
import { db } from './mock-db';
import type { InventoryRow } from '@/lib/types';

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listInventory: builder.query<InventoryRow[], void>({
      async queryFn() {
        await delay(180);
        return { data: db.inventory };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Inventory', id: 'LIST' }, ...result.map(r => ({ type: 'Inventory' as const, id: r.sku }))]
          : [{ type: 'Inventory', id: 'LIST' }],
    }),

    getInventoryRow: builder.query<InventoryRow | undefined, string>({
      async queryFn(sku) {
        await delay(120);
        return { data: db.inventory.find(r => r.sku === sku) };
      },
      providesTags: (_, __, sku) => [{ type: 'Inventory', id: sku }],
    }),

    adjustInventory: builder.mutation<InventoryRow, { sku: string; delta: number; reason: string }>({
      async queryFn({ sku, delta, reason }) {
        await delay(280);
        const idx = db.inventory.findIndex(r => r.sku === sku);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const row = db.inventory[idx];
        const updated: InventoryRow = {
          ...row,
          onHand: Math.max(0, row.onHand + delta),
          available: Math.max(0, row.available + delta),
          movements: [{ type: 'manual', delta, reason, date: 'Just now' }, ...(row.movements || [])],
        };
        db.inventory[idx] = updated;
        // Cascade to product stock
        db.products = db.products.map(p =>
          p.sku === sku ? { ...p, stock: Math.max(0, (p.stock ?? 0) + delta), updatedAt: 'Just now' } : p
        );
        return { data: updated };
      },
      invalidatesTags: (_, __, { sku }) => [
        { type: 'Inventory', id: sku }, { type: 'Inventory', id: 'LIST' },
        { type: 'Product', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' },
      ],
    }),
  }),
});

export const {
  useListInventoryQuery,
  useGetInventoryRowQuery,
  useAdjustInventoryMutation,
} = inventoryApi;
