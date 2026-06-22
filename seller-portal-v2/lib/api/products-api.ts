import { baseApi, delay } from './base-api';
import { db } from './mock-db';
import type { Product, CreateProductDto, StockSeed } from '@/lib/types';

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProducts: builder.query<Product[], void>({
      async queryFn() {
        await delay(200);
        return { data: db.products };
      },
      providesTags: (result) =>
        result
          ? [{ type: 'Product', id: 'LIST' }, ...result.map(p => ({ type: 'Product' as const, id: p.id }))]
          : [{ type: 'Product', id: 'LIST' }],
    }),

    getProduct: builder.query<Product | undefined, string>({
      async queryFn(id) {
        await delay(150);
        return { data: db.products.find(p => p.id === id) };
      },
      providesTags: (_, __, id) => [{ type: 'Product', id }],
    }),

    createProduct: builder.mutation<Product, CreateProductDto & { dimensions?: any[]; hasVariants?: boolean; stock?: StockSeed }>({
      async queryFn(data) {
        await delay(400);
        const id = `p_${Date.now()}`;
        const sku = data.variants?.[0]?.sku || data.name.toUpperCase().slice(0, 8).replace(/\s/g, '');
        // Stock arrives as a separate inventory seed, not inside the product document.
        const stockSeed = data.stock ?? [];
        const stock = stockSeed.length
          ? stockSeed.reduce((s, x) => s + (Number(x.onHand) || 0), 0)
          : null;
        const newProduct: Product = {
          id, name: data.name, sku,
          categoryId: data.categoryId, brandId: data.brandId,
          basePrice: Number(data.basePrice),
          compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : null,
          currency: data.currency || 'USD',
          status: data.status || 'draft',
          isFeatured: !!data.isFeatured,
          stock,
          shortDescription: data.shortDescription,
          description: data.description,
          attributes: data.attributes || [],
          images: data.images || [],
          variants: (data.variants || []) as any,
          localizations: data.localizations,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          totalSold: 0, revenueLifetime: 0, viewsLifetime: 0,
          updatedAt: 'Just now', createdAt: 'Just now',
          initial: data.name[0]?.toUpperCase() || '?',
        };
        db.products = [newProduct, ...db.products];
        // Seed inventory rows — modelled as a separate inventory write from product create.
        if (data.variants?.length) {
          const onHandBySku = new Map(stockSeed.map(x => [x.sku, Number(x.onHand) || 0]));
          db.inventory = [
            ...data.variants.map((v: any) => {
              const onHand = onHandBySku.get(v.sku) ?? 0;
              return {
                sku: v.sku, productName: data.name, productId: id,
                variantInfo: (v.options || []).map((o: any) => `${o.name}: ${o.value}`).join(' · ') || v.name || '—',
                onHand, reserved: 0, available: onHand,
                warehouse: 'Istanbul', reorderThreshold: 5,
                movements: [{ type: 'received' as const, delta: onHand, reason: 'Initial stock', date: 'Just now' }],
              };
            }),
            ...db.inventory,
          ];
        } else if (stockSeed.length) {
          const onHand = Number(stockSeed[0].onHand) || 0;
          db.inventory = [
            {
              sku, productName: data.name, productId: id, variantInfo: '—',
              onHand, reserved: 0, available: onHand,
              warehouse: 'Istanbul', reorderThreshold: 5,
              movements: [{ type: 'received' as const, delta: onHand, reason: 'Initial stock', date: 'Just now' }],
            },
            ...db.inventory,
          ];
        }
        return { data: newProduct };
      },
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, { type: 'Inventory', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),

    updateProduct: builder.mutation<Product, { id: string; patch: Partial<CreateProductDto> & { variants?: any[]; stock?: StockSeed } }>({
      async queryFn({ id, patch }) {
        await delay(300);
        const idx = db.products.findIndex(p => p.id === id);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const existing = db.products[idx];
        const { stock: stockSeed, ...patchRest } = patch;
        const variants = (patch.variants ?? existing.variants ?? []) as any[];

        // Create inventory records for any seeded SKUs that don't have one yet —
        // e.g. variants added during edit, or a product first given stock here.
        // SKUs that already have a record are left untouched so their movement
        // history (received/sold/adjusted) is preserved.
        if (stockSeed?.length) {
          for (const lvl of stockSeed) {
            if (lvl.sku == null || db.inventory.some(r => r.sku === lvl.sku)) continue;
            const onHand = Math.max(0, Number(lvl.onHand) || 0);
            const v = variants.find(x => x.sku === lvl.sku);
            db.inventory = [
              {
                sku: lvl.sku,
                productName: patch.name ?? existing.name,
                productId: id,
                variantInfo: v ? ((v.options || []).map((o: any) => `${o.name}: ${o.value}`).join(' · ') || v.name || '—') : '—',
                onHand, reserved: 0, available: onHand,
                warehouse: 'Istanbul', reorderThreshold: 5,
                movements: [{ type: 'received' as const, delta: onHand, reason: 'Initial stock', date: 'Just now' }],
              },
              ...db.inventory,
            ];
          }
        }

        // Recompute the product's headline stock from its inventory records so it
        // reflects newly-seeded variants too.
        const variantSkus = variants.map(v => v.sku).filter(Boolean);
        let stock: number | null;
        if (variantSkus.length) {
          const rows = db.inventory.filter(r => variantSkus.includes(r.sku));
          stock = rows.length ? rows.reduce((s, r) => s + r.onHand, 0) : existing.stock;
        } else {
          const row = db.inventory.find(r => r.sku === existing.sku);
          stock = row ? row.onHand : existing.stock;
        }

        const updated: Product = {
          ...existing,
          ...patchRest,
          basePrice: patch.basePrice !== undefined ? Number(patch.basePrice) : existing.basePrice,
          compareAtPrice: patch.compareAtPrice !== undefined
            ? (patch.compareAtPrice ? Number(patch.compareAtPrice) : null)
            : existing.compareAtPrice,
          variants: variants as any,
          stock,
          updatedAt: 'Just now',
        };
        // New array, not in-place — the cached array is frozen by RTK/Immer.
        db.products = db.products.map((p, i) => (i === idx ? updated : p));
        return { data: updated };
      },
      invalidatesTags: (_, __, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        { type: 'Inventory', id: 'LIST' },
      ],
    }),

    archiveProduct: builder.mutation<void, string>({
      async queryFn(id) {
        await delay(200);
        db.products = db.products.map(p => p.id === id ? { ...p, status: 'archived', updatedAt: 'Just now' } : p);
        return { data: undefined };
      },
      invalidatesTags: (_, __, id) => [{ type: 'Product', id }, { type: 'Product', id: 'LIST' }],
    }),

    bulkUpdateProducts: builder.mutation<void, { ids: string[]; patch: Partial<Product> }>({
      async queryFn({ ids, patch }) {
        await delay(400);
        const idSet = new Set(ids);
        db.products = db.products.map(p =>
          idSet.has(p.id) ? { ...p, ...patch, updatedAt: 'Just now' } : p
        );
        return { data: undefined };
      },
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),
  }),
});

export const {
  useListProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useArchiveProductMutation,
  useBulkUpdateProductsMutation,
} = productsApi;
