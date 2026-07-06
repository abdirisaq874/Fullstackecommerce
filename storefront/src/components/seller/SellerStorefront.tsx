'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Store, MapPin, Package } from 'lucide-react';
import { Container, Rating, Button } from '@/components/ui';
import { ProductCard, ProductCardSkeleton, productToCard } from '@/components/product/ProductCard';
import { useSellerQuery, useSellerProductsQuery } from '@/store/api/sellersApi';

const SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

export function SellerStorefront({ idOrSlug }: { idOrSlug: string }) {
  const [sortBy, setSortBy] = useState('popular');
  const [page, setPage] = useState(1);
  const { data: seller, isLoading: loadingSeller, isError } = useSellerQuery(idOrSlug);
  const { data: products, isLoading: loadingProducts } = useSellerProductsQuery({ id: idOrSlug, page, limit: 24, sortBy });

  const items = (products?.data ?? []).map(productToCard);
  const meta = products?.meta;

  if (isError) {
    return (
      <Container className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Store not found</h1>
        <Link href="/search" className="mt-4 inline-block"><Button>Browse products</Button></Link>
      </Container>
    );
  }

  return (
    <>
      {/* Store header */}
      <div className="bg-brand-gradient text-white">
        <Container className="py-10">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/15 backdrop-blur">
              {seller?.logoUrl ? (
                <Image src={seller.logoUrl} alt={seller.name} width={80} height={80} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-9 w-9" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-xs uppercase tracking-widest text-white/70">Official store</div>
              <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
                {loadingSeller ? 'Loading…' : seller?.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/85">
                {seller?.avgRating ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Rating value={seller.avgRating} size={16} /> {seller.avgRating.toFixed(1)}
                    {seller.reviewCount ? <span className="text-white/60">({seller.reviewCount})</span> : null}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5"><Package className="h-4 w-4" /> {seller?.productCount ?? 0} products</span>
                {seller?.country && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {seller.country}</span>}
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Products */}
      <Container className="py-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">All products</h2>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="rounded-full border border-line bg-bg px-4 py-2 text-sm font-semibold"
            aria-label="Sort products"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {!loadingProducts && items.length === 0 ? (
          <p className="py-16 text-center text-muted-fg">This store has no products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {loadingProducts
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : items.map((it) => <ProductCard key={it.id} item={it} />)}
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-fg">Page {meta.page} of {meta.totalPages}</span>
            <Button variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </Container>
    </>
  );
}
