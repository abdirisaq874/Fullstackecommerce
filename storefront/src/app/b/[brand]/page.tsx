import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProductListing } from '@/components/listing/ProductListing';
import { Container } from '@/components/ui';
import { ProductCardSkeleton } from '@/components/product/ProductCard';

export function generateMetadata({ params }: { params: { brand: string } }): Metadata {
  const name = params.brand.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  return { title: name };
}

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

export default function BrandPage({ params }: { params: { brand: string } }) {
  return (
    <Suspense fallback={<Fallback />}>
      <ProductListing fixedBrand={params.brand} />
    </Suspense>
  );
}
