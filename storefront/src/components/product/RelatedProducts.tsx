'use client';

import { SectionHeading } from '@/components/ui';
import { ProductCard, ProductCardSkeleton, productToCard } from '@/components/product/ProductCard';
import { useListProductsQuery } from '@/store/api/productsApi';

export function RelatedProducts({ categorySlug, excludeId }: { categorySlug: string; excludeId: string }) {
  const { data, isLoading } = useListProductsQuery({ category: categorySlug, limit: 10, sortBy: 'popular' });
  const items = (data?.data ?? []).filter((p) => p._id !== excludeId).slice(0, 5).map(productToCard);

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="mt-16">
      <SectionHeading eyebrow="You might also like" title="Related products" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items.map((it) => <ProductCard key={it.id} item={it} />)}
      </div>
    </section>
  );
}
