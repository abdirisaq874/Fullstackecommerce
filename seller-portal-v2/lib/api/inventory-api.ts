import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';
import type { InventoryRow } from '@/lib/types';

/**
 * Backend inventory document shape returned by
 *   GET  /inventory/product/:productId
 *   POST /inventory/adjust
 *
 * The Nest service hands back the raw Mongo schema (see
 * ecommerce-backend/src/inventory/schemas/inventory.schema.ts), so we mirror
 * the fields we care about here.
 */
interface BackendInventoryDoc {
  _id?: string;
  variantSku: string;
  productId?: string;
  warehouseId?: string;
  quantity: number;
  reserved: number;
  reorderPoint: number;
}

/** Shape of `GET /inventory/check/:sku`. */
interface BackendStockCheck {
  sku: string;
  available: number;
}

/**
 * Map a raw backend inventory doc → frontend `InventoryRow`.
 *
 * Several fields the UI expects (productName, variantInfo, warehouse name,
 * movements history) are not yet exposed by the backend's inventory routes.
 * We fill them with safe defaults; a follow-up backend endpoint should
 * return enriched data (or the seller-portal can fetch product + warehouse
 * separately and join client-side).
 */
function toInventoryRow(doc: BackendInventoryDoc): InventoryRow {
  const onHand = doc.quantity ?? 0;
  const reserved = doc.reserved ?? 0;
  return {
    sku: doc.variantSku,
    productName: '', // TODO(backend): join Product.name into inventory response
    productId: doc.productId ?? '',
    variantInfo: '', // TODO(backend): include variant option summary
    onHand,
    reserved,
    available: Math.max(0, onHand - reserved),
    warehouse: doc.warehouseId ?? '', // TODO(backend): resolve warehouse name
    reorderThreshold: doc.reorderPoint ?? 0,
    movements: [], // TODO(backend): expose recent InventoryMovement entries
  };
}

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * NOTE: the backend does not expose an "all SKUs paginated" inventory list
     * route yet. The closest endpoint is `GET /inventory/product/:productId`
     * which returns rows for a single product. Until a global list endpoint
     * exists this query takes an optional `productId` and falls back to an
     * empty array when not provided so the screen doesn't crash.
     *
     * TODO(backend C3): add `GET /inventory?page=&limit=` returning paginated
     * enriched rows (sku + product name + variant + warehouse + movements).
     */
    listInventory: builder.query<InventoryRow[], string | void>({
      async queryFn(productId, _api, _extra, fetchWithBQ) {
        // No productId → resolve to empty list without hitting the network.
        // Avoids a hardcoded "/inventory/product/none" placeholder request
        // that 400s on every page load.
        // TODO(backend C3): add `GET /inventory?page=&limit=` for a real
        // "all SKUs paginated" endpoint and switch this to a plain `query`.
        if (!productId) {
          return { data: [] as InventoryRow[] };
        }
        const res = await fetchWithBQ({
          url: `/inventory/product/${productId}`,
          method: 'GET',
        });
        if (res.error) return { error: res.error };
        const docs = unwrapEnvelope<BackendInventoryDoc[]>(
          res.data as ResponseEnvelope<BackendInventoryDoc[]> | BackendInventoryDoc[],
        ) ?? [];
        return { data: docs.map(toInventoryRow) };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Inventory', id: 'LIST' }, ...result.map(r => ({ type: 'Inventory' as const, id: r.sku }))]
          : [{ type: 'Inventory', id: 'LIST' }],
    }),

    getInventoryRow: builder.query<InventoryRow | undefined, string>({
      query: (sku) => ({
        url: `/inventory/check/${encodeURIComponent(sku)}`,
        method: 'GET',
      }),
      transformResponse: (res: ResponseEnvelope<BackendStockCheck> | BackendStockCheck): InventoryRow => {
        const { sku, available } = unwrapEnvelope<BackendStockCheck>(res);
        // `/check/:sku` only returns availability; pad the rest with defaults
        // until a richer single-row endpoint exists.
        return {
          sku,
          productName: '',
          productId: '',
          variantInfo: '',
          onHand: available,
          reserved: 0,
          available,
          warehouse: '',
          reorderThreshold: 0,
          movements: [],
        };
      },
      providesTags: (_, __, sku) => [{ type: 'Inventory', id: sku }],
    }),

    adjustInventory: builder.mutation<InventoryRow, { sku: string; delta: number; reason: string }>({
      query: ({ sku, delta, reason }) => ({
        url: '/inventory/adjust',
        method: 'POST',
        body: {
          variantSku: sku,
          quantity: delta,
          notes: reason,
        },
      }),
      transformResponse: (res: ResponseEnvelope<BackendInventoryDoc> | BackendInventoryDoc): InventoryRow => {
        const doc = unwrapEnvelope<BackendInventoryDoc>(res);
        return toInventoryRow(doc);
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
