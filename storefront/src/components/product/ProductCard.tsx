'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Heart, ShoppingBag } from 'lucide-react';
import { cn, localizedText } from '@/lib/utils';
import { Price, Rating, Badge } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleWishlist } from '@/store/slices/wishlistSlice';
import type { Product, SmartSearchResult } from '@/types';

export interface ProductCardItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  currency: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  localizations?: Record<string, { name?: string }>;
}

export function productToCard(p: Product): ProductCardItem {
  const img = p.images?.find((i) => i.isPrimary) ?? p.images?.[0];
  return {
    id: p._id,
    slug: p.slug,
    name: p.name,
    price: p.basePrice,
    compareAt: p.compareAtPrice,
    currency: p.currency || 'USD',
    imageUrl: img?.url,
    rating: p.avgRating,
    reviewCount: p.reviewCount,
    isFeatured: p.isFeatured,
    localizations: p.localizations,
  };
}

export function searchHitToCard(r: SmartSearchResult): ProductCardItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    price: r.price,
    currency: r.currency || 'USD',
    imageUrl: r.imageUrl,
    rating: r.avgRating,
    isFeatured: r.isFeatured,
  };
}

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle" dy=".3em">No image</text></svg>`,
  );

export function ProductCard({ item }: { item: ProductCardItem }) {
  const dispatch = useAppDispatch();
  const locale = useLocale();
  const name = localizedText(item.localizations, locale, 'name', item.name);
  const wished = useAppSelector((s) => s.wishlist.items.some((w) => w.productId === item.id));

  return (
    <div className="group relative animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/product/${item.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Image
            src={item.imageUrl || PLACEHOLDER}
            alt={name}
            fill
            sizes="(max-width:768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {item.compareAt && item.compareAt > item.price && (
            <Badge variant="sale" className="absolute left-3 top-3">SALE</Badge>
          )}
          {item.isFeatured && (
            <Badge variant="brand" className="absolute right-3 top-3">★ Featured</Badge>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={() =>
          dispatch(
            toggleWishlist({
              productId: item.id,
              slug: item.slug,
              name,
              price: item.price,
              currency: item.currency,
              imageUrl: item.imageUrl,
            }),
          )
        }
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        className="focus-ring absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 shadow-card backdrop-blur transition hover:scale-110"
      >
        <Heart className={cn('h-4 w-4', wished ? 'fill-accent text-accent' : 'text-ink')} />
      </button>

      <div className="space-y-2 p-4">
        <Link href={`/product/${item.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold leading-snug hover:text-brand">{name}</h3>
        </Link>
        {item.rating !== undefined && <Rating value={item.rating} count={item.reviewCount} />}
        <div className="flex items-center justify-between pt-1">
          <Price amount={item.price} compareAt={item.compareAt} currency={item.currency} />
          <Link
            href={`/product/${item.slug}`}
            aria-label="View product"
            className="focus-ring grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-pop transition hover:brightness-110"
          >
            <ShoppingBag className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-6 w-1/2" />
      </div>
    </div>
  );
}
