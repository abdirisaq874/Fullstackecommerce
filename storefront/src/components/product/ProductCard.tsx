'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Heart } from 'lucide-react';
import { cn, localizedText } from '@/lib/utils';
import { Price, Rating } from '@/components/ui';
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
  isNew?: boolean;
  category?: string;
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

// Soft two-tone gradient tiles, tinted deterministically per product.
const TINTS = [
  'from-indigo-100 to-violet-50',
  'from-rose-100 to-orange-50',
  'from-emerald-100 to-teal-50',
  'from-pink-100 to-fuchsia-50',
  'from-sky-100 to-indigo-50',
  'from-amber-100 to-rose-50',
];
function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function ProductCard({ item }: { item: ProductCardItem }) {
  const dispatch = useAppDispatch();
  const locale = useLocale();
  const name = localizedText(item.localizations, locale, 'name', item.name);
  const wished = useAppSelector((s) => s.wishlist.items.some((w) => w.productId === item.id));
  const onSale = !!item.compareAt && item.compareAt > item.price;
  const tint = tintFor(item.slug || item.id);

  return (
    <div className="group relative animate-fade-up overflow-hidden rounded-3xl bg-surface ring-1 ring-line/70 shadow-card transition-all hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/product/${item.slug}`} className="block">
        <div className={cn('relative aspect-square overflow-hidden bg-gradient-to-br', tint)}>
          {item.imageUrl && (
            <Image
              src={item.imageUrl}
              alt={name}
              fill
              sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}
          {onSale ? (
            <span className="absolute left-3 top-3 rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold text-white">Sale</span>
          ) : item.isNew ? (
            <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">New</span>
          ) : null}
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
        <Heart className={cn('h-4 w-4', wished ? 'fill-brand text-brand' : 'text-ink')} />
      </button>

      <div className="space-y-1.5 p-4">
        {item.category && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-fg">{item.category}</span>
        )}
        <Link href={`/product/${item.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-ink hover:text-brand">{name}</h3>
        </Link>
        {item.rating !== undefined && <Rating value={item.rating} count={item.reviewCount} />}
        <div className="pt-1">
          <Price amount={item.price} compareAt={item.compareAt} currency={item.currency} />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line/70">
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-5 w-1/2" />
      </div>
    </div>
  );
}
