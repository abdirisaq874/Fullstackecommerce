'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button, Container, EmptyState } from '@/components/ui';
import { ProductCard, type ProductCardItem } from '@/components/product/ProductCard';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearWishlist } from '@/store/slices/wishlistSlice';

export default function WishlistPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.wishlist.items);

  const cards: ProductCardItem[] = items.map((w) => ({
    id: w.productId,
    slug: w.slug,
    name: w.name,
    price: w.price,
    currency: w.currency,
    imageUrl: w.imageUrl,
  }));

  return (
    <Container className="py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Your wishlist</h1>
        {items.length > 0 && (
          <button onClick={() => dispatch(clearWishlist())} className="text-sm font-semibold text-muted-fg hover:text-danger">
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-12 w-12" />}
          title="No saved items yet"
          description="Tap the heart on any product to save it here for later."
          action={<Link href="/search"><Button size="lg">Discover products</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((it) => <ProductCard key={it.id} item={it} />)}
        </div>
      )}
    </Container>
  );
}
