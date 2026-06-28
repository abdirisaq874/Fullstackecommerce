import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProductListing } from '@/components/listing/ProductListing';
import { Container } from '@/components/ui';
import { ProductCardSkeleton } from '@/components/product/ProductCard';

export const metadata: Metadata = { title: 'Search' };

function Fallback() {
  return (
    <Container className="py-8">
      <div className="skeleton mb-6 h-9 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    </Container>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ProductListing />
    </Suspense>
  );
}
