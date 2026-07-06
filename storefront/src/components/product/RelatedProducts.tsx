'use client';

import { SectionHeading } from '@/components/ui';
import { ProductCard, ProductCardSkeleton, productToCard } from '@/components/product/ProductCard';
import { useRelatedProductsQuery } from '@/store/api/recommendationsApi';

/** Semantically similar products (vector k-NN, category fallback server-side). */
export function RelatedProducts({ productId }: { productId: string }) {
  const { data, isLoading } = useRelatedProductsQuery({ productId, limit: 5 });
  const items = (data ?? []).map(productToCard);

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
