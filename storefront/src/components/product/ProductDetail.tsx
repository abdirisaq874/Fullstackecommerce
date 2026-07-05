'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Heart, ShoppingBag, Truck, ShieldCheck, RefreshCcw, ChevronRight, MessageCircle, Check,
} from 'lucide-react';
import { cn, localizedText } from '@/lib/utils';
import { ZoomImage } from './ZoomImage';
import { Button, Price, Rating, Badge, QtyStepper, Container } from '@/components/ui';
import { useProductBySlugQuery } from '@/store/api/productsApi';
import { useAddToCartMutation } from '@/store/api/cartApi';
import { useCheckStockQuery } from '@/store/api/inventoryApi';
import { useCreateThreadMutation } from '@/store/api/messagesApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { openCart } from '@/store/slices/uiSlice';
import { toggleWishlist } from '@/store/slices/wishlistSlice';
import { ProductReviews } from './ProductReviews';
import { RelatedProducts } from './RelatedProducts';
import type { Category } from '@/types';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="#f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="22" fill="#94a3b8" text-anchor="middle" dy=".3em">No image</text></svg>`,
  );

export function ProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const locale = useLocale();
  const token = useAppSelector((s) => s.auth.accessToken);
  const { data: product, isLoading, isError } = useProductBySlugQuery(slug);
  const [addToCart, { isLoading: adding }] = useAddToCartMutation();
  const [createThread, { isLoading: messaging }] = useCreateThreadMutation();

  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description');

  const optionGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    (product?.variants ?? []).forEach((v) =>
      v.options?.forEach((o) => {
        groups[o.name] = groups[o.name] ?? [];
        if (!groups[o.name].includes(o.value)) groups[o.name].push(o.value);
      }),
    );
    return Object.entries(groups).map(([name, values]) => ({ name, values }));
  }, [product]);

  const selectedVariant = useMemo(() => {
    const vs = product?.variants ?? [];
    if (!vs.length) return undefined;
    const match = vs.find((v) =>
      optionGroups.every((g) => v.options?.find((o) => o.name === g.name)?.value === selected[g.name]),
    );
    return match ?? vs[0];
  }, [product, optionGroups, selected]);

  useEffect(() => {
    const first = product?.variants?.[0];
    if (first?.options?.length) {
      setSelected(Object.fromEntries(first.options.map((o) => [o.name, o.value])));
    }
  }, [product]);

  const { data: stock } = useCheckStockQuery(selectedVariant?.sku ?? '', { skip: !selectedVariant?.sku });
  const outOfStock = stock?.inStock === false || stock?.available === 0;
  const wished = useAppSelector((s) => (product ? s.wishlist.items.some((w) => w.productId === product._id) : false));

  if (isLoading) return <DetailSkeleton />;
  if (isError || !product)
    return (
      <Container className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Product not found</h1>
        <Link href="/search" className="mt-4 inline-block"><Button>Back to shop</Button></Link>
      </Container>
    );

  const images = [...(product.images ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const mainImg = images[activeImg]?.url || images[0]?.url || PLACEHOLDER;
  const price = selectedVariant?.priceOverride ?? product.basePrice;
  const displayName = localizedText(product.localizations, locale, 'name', product.name);
  const displayShort = localizedText(product.localizations, locale, 'shortDescription', product.shortDescription);
  const displayDesc = localizedText(product.localizations, locale, 'description', product.description);
  const category = product.categoryId as Category | string | undefined;
  const categoryObj = typeof category === 'object' ? category : undefined;
  const sellerId = (product as any).sellerId as string | undefined;

  const requireAuth = (next: () => void) => {
    if (!token) {
      toast.error('Please sign in to continue');
      router.push(`/login?redirect=/product/${slug}`);
      return;
    }
    next();
  };

  const handleAdd = (buyNow = false) =>
    requireAuth(async () => {
      if (!selectedVariant) {
        toast.error('This product is unavailable');
        return;
      }
      try {
        await addToCart({ productId: product._id, variantSku: selectedVariant.sku, quantity: qty }).unwrap();
        if (buyNow) router.push('/checkout');
        else {
          toast.success('Added to cart');
          dispatch(openCart());
        }
      } catch {
        toast.error('Could not add to cart');
      }
    });

  const handleAskSeller = () =>
    requireAuth(async () => {
      if (!sellerId) return;
      try {
        const res = await createThread({
          recipientUserId: sellerId,
          subject: `Question about ${displayName}`,
          body: `Hi, I have a question about "${displayName}".`,
        }).unwrap();
        toast.success('Message sent');
        router.push(`/account/messages?thread=${res.thread._id}`);
      } catch {
        toast.error('Could not send message');
      }
    });

  return (
    <Container className="py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-fg" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand">Home</Link>
        <ChevronRight className="h-4 w-4" />
        {categoryObj && (
          <>
            <Link href={`/c/${categoryObj.slug}`} className="hover:text-brand">{categoryObj.name}</Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="truncate text-ink">{displayName}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative">
            <ZoomImage src={mainImg} alt={product.name} />
            {product.compareAtPrice && product.compareAtPrice > price && (
              <Badge variant="sale" className="absolute left-4 top-4 z-10 text-sm">SALE</Badge>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img._id ?? i}
                  onClick={() => setActiveImg(i)}
                  className={cn('relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition', i === activeImg ? 'border-brand' : 'border-line hover:border-ink/30')}
                  aria-label={`Image ${i + 1}`}
                >
                  <Image src={img.url} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {typeof product.brandId === 'object' && (product.brandId as any)?.name && (
            <Link href={`/b/${(product.brandId as any).slug}`} className="text-sm font-bold uppercase tracking-wide text-accent">
              {(product.brandId as any).name}
            </Link>
          )}
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{displayName}</h1>
          <div className="mt-3 flex items-center gap-3">
            <Rating value={product.avgRating} count={product.reviewCount} size={18} />
            {product.totalSold ? <span className="text-sm text-muted-fg">{product.totalSold} sold</span> : null}
          </div>

          <div className="mt-5">
            <Price amount={price} compareAt={product.compareAtPrice} currency={product.currency} className="text-2xl [&_span:first-child]:text-3xl" />
          </div>

          {displayShort && <p className="mt-4 text-muted-fg">{displayShort}</p>}

          {/* Variant options */}
          {optionGroups.map((g) => (
            <div key={g.name} className="mt-6">
              <p className="mb-2 text-sm font-bold">{g.name}</p>
              <div className="flex flex-wrap gap-2">
                {g.values.map((val) => {
                  const active = selected[g.name] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setSelected((s) => ({ ...s, [g.name]: val }))}
                      className={cn('rounded-xl border-2 px-4 py-2 text-sm font-semibold transition', active ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand')}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Stock */}
          <div className="mt-5">
            {outOfStock ? (
              <Badge variant="neutral">Out of stock</Badge>
            ) : stock?.available !== undefined && stock.available <= 5 ? (
              <Badge variant="sale">Only {stock.available} left</Badge>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success"><Check className="h-4 w-4" /> In stock</span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} />
            <Button size="lg" loading={adding} disabled={outOfStock || !selectedVariant} onClick={() => handleAdd(false)} className="flex-1 gap-2">
              <ShoppingBag className="h-5 w-5" /> Add to cart
            </Button>
            <Button size="lg" variant="secondary" disabled={outOfStock || !selectedVariant} onClick={() => handleAdd(true)}>
              Buy now
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Add to wishlist"
              onClick={() =>
                dispatch(toggleWishlist({
                  productId: product._id, slug: product.slug, name: displayName,
                  price, currency: product.currency, imageUrl: images[0]?.url,
                }))
              }
            >
              <Heart className={cn('h-5 w-5', wished && 'fill-accent text-accent')} />
            </Button>
          </div>

          {sellerId && (
            <button onClick={handleAskSeller} disabled={messaging} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
              <MessageCircle className="h-4 w-4" /> Ask the seller a question
            </button>
          )}

          {/* Trust */}
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-line pt-6 text-center text-xs font-semibold text-muted-fg">
            <div className="flex flex-col items-center gap-1"><Truck className="h-5 w-5 text-brand" /> Fast delivery</div>
            <div className="flex flex-col items-center gap-1"><ShieldCheck className="h-5 w-5 text-brand" /> Secure checkout</div>
            <div className="flex flex-col items-center gap-1"><RefreshCcw className="h-5 w-5 text-brand" /> Easy returns</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-14">
        <div className="flex gap-2 border-b border-line">
          {(['description', 'specs', 'reviews'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('relative px-4 py-3 text-sm font-bold capitalize transition', tab === t ? 'text-brand' : 'text-muted-fg hover:text-ink')}
            >
              {t === 'specs' ? 'Specifications' : t === 'reviews' ? `Reviews (${product.reviewCount ?? 0})` : 'Description'}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-gradient" />}
            </button>
          ))}
        </div>
        <div className="py-6">
          {tab === 'description' && (
            <div className="prose max-w-none whitespace-pre-wrap text-ink/90">{displayDesc || 'No description available.'}</div>
          )}
          {tab === 'specs' && (
            <div className="max-w-2xl">
              {(product.attributes ?? []).length === 0 ? (
                <p className="text-muted-fg">No specifications listed.</p>
              ) : (
                <dl className="divide-y divide-line">
                  {(product.attributes ?? []).map((a, i) => (
                    <div key={i} className="grid grid-cols-3 gap-4 py-3">
                      <dt className="font-semibold capitalize text-muted-fg">{a.key}</dt>
                      <dd className="col-span-2">{a.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
          {tab === 'reviews' && <ProductReviews productId={product._id} />}
        </div>
      </div>

      {/* Related */}
      {categoryObj?.slug && <RelatedProducts categorySlug={categoryObj.slug} excludeId={product._id} />}
    </Container>
  );
}

function DetailSkeleton() {
  return (
    <Container className="py-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="skeleton aspect-square rounded-3xl" />
        <div className="space-y-4">
          <div className="skeleton h-10 w-3/4" />
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton h-8 w-1/4" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </div>
    </Container>
  );
}
