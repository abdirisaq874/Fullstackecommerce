import { baseApi, delay } from './base-api';
import { db } from './mock-db';
import type { Product, CreateProductDto } from '@/lib/types';

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

    createProduct: builder.mutation<Product, CreateProductDto & { dimensions?: any[]; hasVariants?: boolean; stockOnHand?: any }>({
      async queryFn(data) {
        await delay(400);
        const id = `p_${Date.now()}`;
        const sku = data.variants?.[0]?.sku || data.name.toUpperCase().slice(0, 8).replace(/\s/g, '');
        const stock = data.variants?.length
          ? data.variants.reduce((s, v: any) => s + (Number(v.stockOnHand) || 0), 0)
          : data.stockOnHand !== undefined && data.stockOnHand !== ''
            ? Number(data.stockOnHand)
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
          salesCount: 0, revenueLifetime: 0, viewsLifetime: 0,
          updatedAt: 'Just now', createdAt: 'Just now',
          initial: data.name[0]?.toUpperCase() || '?',
        };
        db.products = [newProduct, ...db.products];
        // Also seed inventory rows for each variant
        if (data.variants?.length) {
          db.inventory = [
            ...data.variants.map((v: any) => ({
              sku: v.sku, productName: data.name, productId: id,
              variantInfo: (v.options || []).map((o: any) => `${o.name}: ${o.value}`).join(' · ') || v.name || '—',
              onHand: Number(v.stockOnHand) || 0, reserved: 0, available: Number(v.stockOnHand) || 0,
              warehouse: 'Istanbul', reorderThreshold: 5,
              movements: [{ type: 'received' as const, delta: Number(v.stockOnHand) || 0, reason: 'Initial stock', date: 'Just now' }],
            })),
            ...db.inventory,
          ];
        }
        return { data: newProduct };
      },
      invalidatesTags: [{ type: 'Product', id: 'LIST' }, { type: 'Inventory', id: 'LIST' }, { type: 'Dashboard', id: 'METRICS' }],
    }),

    updateProduct: builder.mutation<Product, { id: string; patch: Partial<CreateProductDto> & { variants?: any[] } }>({
      async queryFn({ id, patch }) {
        await delay(300);
        const idx = db.products.findIndex(p => p.id === id);
        if (idx < 0) return { error: { status: 404, data: 'Not found' } } as any;
        const existing = db.products[idx];
        const stock = patch.variants?.length
          ? patch.variants.reduce((s, v: any) => s + (Number(v.stockOnHand) || 0), 0)
          : existing.stock;
        const updated: Product = {
          ...existing,
          ...patch,
          basePrice: patch.basePrice !== undefined ? Number(patch.basePrice) : existing.basePrice,
          compareAtPrice: patch.compareAtPrice !== undefined
            ? (patch.compareAtPrice ? Number(patch.compareAtPrice) : null)
            : existing.compareAtPrice,
          variants: (patch.variants ?? existing.variants) as any,
          stock,
          updatedAt: 'Just now',
        };
        db.products[idx] = updated;
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
