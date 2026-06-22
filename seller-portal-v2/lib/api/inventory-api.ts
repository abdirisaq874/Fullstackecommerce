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
        // Reassign with a new array — RTK/Immer freezes the cached array after a
        // query reads it, so an in-place `db.inventory[idx] = …` would throw.
        db.inventory = db.inventory.map((r, i) => (i === idx ? updated : r));
        // Cascade to the owning product's headline stock. A variant product's
        // stock is the SUM of its variants, so recompute from every inventory row
        // that belongs to the product (by productId) — matching on the single
        // adjusted SKU would miss variants whose SKU differs from the product's.
        const productId = updated.productId;
        if (productId) {
          const total = db.inventory
            .filter(r => r.productId === productId)
            .reduce((s, r) => s + r.onHand, 0);
          db.products = db.products.map(p =>
            p.id === productId ? { ...p, stock: total, updatedAt: 'Just now' } : p
          );
        }
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
