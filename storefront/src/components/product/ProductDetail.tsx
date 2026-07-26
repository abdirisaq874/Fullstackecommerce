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
import { useGetStockLevelsQuery } from '@/store/api/inventoryApi';
import { useCreateThreadMutation } from '@/store/api/messagesApi';
import { useSellerQuery } from '@/store/api/sellersApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { openCart } from '@/store/slices/uiSlice';
import { toggleWishlist } from '@/store/slices/wishlistSlice';
import { ProductReviews } from './ProductReviews';
import { RelatedProducts } from './RelatedProducts';
import { FrequentlyBoughtTogether } from './FrequentlyBoughtTogether';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import * as metaPixel from '@/lib/meta-pixel';
import type { Category } from '@/types';

// Colour-name → hex, used to render a solid swatch when a colour has no tagged
// product image. Includes Turkish names (the imported catalogue is Turkish).
const COLOR_HEX: Record<string, string> = {
  black: '#111111', siyah: '#111111', beyaz: '#ffffff', white: '#ffffff',
  red: '#dc2626', kirmizi: '#dc2626', kırmızı: '#dc2626', bordo: '#7f1d1d', maroon: '#7f1d1d',
  blue: '#2563eb', mavi: '#2563eb', lacivert: '#1e3a8a', navy: '#1e3a8a',
  green: '#16a34a', yesil: '#16a34a', yeşil: '#16a34a', haki: '#4d5d3a', khaki: '#b5a642',
  yellow: '#eab308', sari: '#eab308', sarı: '#eab308',
  orange: '#f97316', turuncu: '#f97316',
  purple: '#7c3aed', mor: '#7c3aed', lila: '#c084fc', lilac: '#c084fc',
  pink: '#ec4899', pembe: '#ec4899',
  gray: '#6b7280', grey: '#6b7280', gri: '#6b7280',
  brown: '#92400e', kahverengi: '#92400e', kahve: '#92400e',
  beige: '#e3c9a8', bej: '#e3c9a8', krem: '#f5f0e1', cream: '#f5f0e1', ekru: '#e8e0cf',
  gold: '#d4af37', altin: '#d4af37', altın: '#d4af37',
  silver: '#c0c0c0', gumus: '#c0c0c0', gümüş: '#c0c0c0',
};

// Resolve a colour name (possibly multi-word, e.g. "Abanoz Siyah") to a hex by
// matching any known colour word within it.
function colorToHex(name: string): string | undefined {
  const words = name.toLowerCase().split(/[\s/,-]+/).filter(Boolean);
  for (const w of words) if (COLOR_HEX[w]) return COLOR_HEX[w];
  return COLOR_HEX[name.toLowerCase().trim()];
}

export function ProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const locale = useLocale();
  const token = useAppSelector((s) => s.auth.accessToken);
  const { data: product, isLoading, isError } = useProductBySlugQuery(slug);
  const [addToCart, { isLoading: adding }] = useAddToCartMutation();
  const [createThread, { isLoading: messaging }] = useCreateThreadMutation();
  const { track } = useRecentlyViewed();
  const sellerRef = (product as any)?.sellerId as string | undefined;
  const { data: sellerInfo } = useSellerQuery(sellerRef ?? '', { skip: !sellerRef });

  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [showAllCrumbs, setShowAllCrumbs] = useState(false);

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

  // Reset the gallery to the first image whenever the selected colour changes.
  useEffect(() => { setActiveImg(0); }, [JSON.stringify(selected)]);

  // Record the view for "Recently viewed" + personalized "For you".
  useEffect(() => {
    if (!product) return;
    const img = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
    track({
      id: product._id,
      slug: product.slug,
      name: product.name,
      price: product.basePrice,
      currency: product.currency,
      imageUrl: img?.url,
    });
  }, [product, track]);

  // Meta Pixel ViewContent — content id is the slug (matches the catalog feed).
  useEffect(() => {
    if (!product) return;
    metaPixel.viewContent({
      id: product.slug,
      name: product.name,
      value: product.basePrice,
      currency: product.currency,
    });
  }, [product]);

  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const { data: stockLevels } = useGetStockLevelsQuery(product?._id ?? '', {
    skip: !product?._id || !hasVariants,
  });
  const stockMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of stockLevels ?? []) m[l.variantSku] = Math.max(0, (l.quantity ?? 0) - (l.reserved ?? 0));
    return m;
  }, [stockLevels]);
  const productStock = (product as any)?.stock ?? 0;
  // Per-variant: use the SKU's REAL inventory (incl. 0 → out of stock); fall back
  // to product.stock only when the SKU has no inventory record (untracked).
  const selSku = selectedVariant?.sku;
  const available = hasVariants
    ? (selSku && selSku in stockMap ? stockMap[selSku] : productStock)
    : productStock;
  const outOfStock = available <= 0;
  const wished = useAppSelector((s) => (product ? s.wishlist.items.some((w) => w.productId === product._id) : false));

  if (isLoading) return <DetailSkeleton />;
  if (isError || !product)
    return (
      <Container className="py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Product not found</h1>
        <Link href="/search" className="mt-4 inline-block"><Button>Back to shop</Button></Link>
      </Container>
    );

  const allImages = [...(product.images ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  // Dimension-agnostic variant images: an image shows when EVERY entry in its
  // `appliesTo` matches the current selection (color / material / sleeve / combo).
  // Back-compat: an image tagged only via altText=<optionValue> is treated as an
  // appliesTo for whichever dimension owns that value. Images with neither are
  // shared and always show. Result = shared images + the ones matching selection.
  const dimForValue = (val: string) => optionGroups.find((g) => g.values.includes(val))?.name;
  const imageApplies = (im: (typeof allImages)[number]) => {
    const rules =
      im.appliesTo && im.appliesTo.length
        ? im.appliesTo
        : im.altText && dimForValue(im.altText)
          ? [{ name: dimForValue(im.altText) as string, value: im.altText }]
          : [];
    if (!rules.length) return true; // shared / general image
    return rules.every((r) => selected[r.name] === r.value);
  };
  const matched = allImages.filter(imageApplies);
  const images = matched.length ? matched : allImages;
  // Per-variant availability for the option selectors: a value is "sold out" when
  // every variant carrying it (holding the other picked dimensions fixed) is at 0
  // stock. Untracked SKUs fall back to product-level stock; indeterminate → shown.
  const isValueAvailable = (groupName: string, val: string) => {
    const matching = (product.variants ?? []).filter((v) => {
      const opts = Object.fromEntries((v.options ?? []).map((o) => [o.name, o.value]));
      if (opts[groupName] !== val) return false;
      return Object.entries(selected).every(([k, sv]) => k === groupName || !sv || opts[k] === sv);
    });
    if (!matching.length) return true;
    return matching.some((v) => (v.sku in stockMap ? stockMap[v.sku] : productStock) > 0);
  };
  const price = selectedVariant?.priceOverride ?? product.basePrice;
  const displayName = localizedText(product.localizations, locale, 'name', product.name);
  const displayShort = localizedText(product.localizations, locale, 'shortDescription', product.shortDescription);
  const displayDesc = localizedText(product.localizations, locale, 'description', product.description);
  const category = product.categoryId as Category | string | undefined;
  const categoryObj = typeof category === 'object' ? category : undefined;
  const sellerId = (product as any).sellerId as string | undefined;

  // Breadcrumb trail (root→leaf). Prefer the API-resolved trail; fall back to
  // the single populated category. Deep trails collapse their middle behind an
  // expandable ellipsis so the bar never overflows.
  type CrumbItem =
    | { kind: 'crumb'; name: string; slug: string }
    | { kind: 'ellipsis'; hidden: string };
  const categoryTrail =
    product.categoryTrail && product.categoryTrail.length
      ? product.categoryTrail
      : categoryObj
        ? [{ name: categoryObj.name, slug: categoryObj.slug }]
        : [];
  const collapseCrumbs = categoryTrail.length > 4 && !showAllCrumbs;
  const hiddenCrumbs = collapseCrumbs ? categoryTrail.slice(1, -2) : [];
  const crumbItems: CrumbItem[] = collapseCrumbs
    ? [
        { kind: 'crumb', name: categoryTrail[0].name, slug: categoryTrail[0].slug },
        { kind: 'ellipsis', hidden: hiddenCrumbs.map((c) => c.name).join(' › ') },
        ...categoryTrail.slice(-2).map((c) => ({ kind: 'crumb' as const, name: c.name, slug: c.slug })),
      ]
    : categoryTrail.map((c) => ({ kind: 'crumb' as const, name: c.name, slug: c.slug }));

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
      if (hasVariants && !selectedVariant) {
        toast.error('Please select an option');
        return;
      }
      try {
        await addToCart({ productId: product._id, variantSku: selectedVariant?.sku, quantity: qty }).unwrap();
        metaPixel.addToCart({
          id: product.slug,
          name: product.name,
          quantity: qty,
          value: price * qty,
          currency: product.currency,
        });
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
        <Link href="/" className="shrink-0 hover:text-brand">Home</Link>
        {crumbItems.map((it, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 shrink-0" />
            {it.kind === 'ellipsis' ? (
              <button
                type="button"
                onClick={() => setShowAllCrumbs(true)}
                title={it.hidden}
                aria-label={`Show ${hiddenCrumbs.length} more categories`}
                className="shrink-0 px-0.5 leading-none hover:text-brand"
              >
                …
              </button>
            ) : (
              <Link href={`/c/${it.slug}`} className="shrink-0 whitespace-nowrap hover:text-brand">
                {it.name}
              </Link>
            )}
          </span>
        ))}
        <ChevronRight className="h-4 w-4 shrink-0" />
        <span className="truncate text-ink">{displayName}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="relative">
            <ZoomImage
              images={images}
              index={activeImg}
              alt={product.name}
              onIndexChange={setActiveImg}
            />
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
          {sellerId && (
            <div className="mt-2 text-sm text-muted-fg">
              Sold by{' '}
              <Link href={`/s/${sellerId}`} className="font-semibold text-brand hover:underline">
                {sellerInfo?.name || 'this store'}
              </Link>
            </div>
          )}

          <div className="mt-5">
            <Price amount={price} compareAt={product.compareAtPrice} currency={product.currency} className="text-2xl [&_span:first-child]:text-3xl" />
          </div>

          {displayShort && <p className="mt-4 text-muted-fg">{displayShort}</p>}

          {/* Variant options */}
          {optionGroups.map((g) => {
            const isColor = /^(colou?r|renk)$/i.test(g.name);
            return (
              <div key={g.name} className="mt-6">
                <p className="mb-2 text-sm font-bold">
                  {g.name}
                  {isColor && selected[g.name] && (
                    <span className="ml-2 font-normal text-muted-fg">{selected[g.name]}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.values.map((val) => {
                    const active = selected[g.name] === val;
                    const soldOut = !isValueAvailable(g.name, val);
                    if (isColor) {
                      // Visual swatch: prefer the product photo tagged with this
                      // colour, then a solid hex chip, then an abbreviated label.
                      const swatchImg = allImages.find(
                        (im) =>
                          im.appliesTo?.some((a) => a.name === g.name && a.value === val) ||
                          im.altText === val,
                      )?.url;
                      const hex = colorToHex(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSelected((s) => ({ ...s, [g.name]: val }))}
                          title={soldOut ? `${val} — out of stock` : val}
                          aria-label={soldOut ? `${val} (out of stock)` : val}
                          aria-pressed={active}
                          className={cn(
                            'relative h-12 w-12 overflow-hidden rounded-xl border-2 transition',
                            active ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-brand',
                            soldOut && 'opacity-40',
                          )}
                        >
                          {swatchImg ? (
                            <Image src={swatchImg} alt={val} fill className="object-cover" sizes="48px" />
                          ) : (
                            <span className="block h-full w-full" style={{ backgroundColor: hex ?? '#e5e7eb' }} />
                          )}
                          {!swatchImg && !hex && (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-ink">
                              {val.slice(0, 3)}
                            </span>
                          )}
                          {active && (
                            <span className="absolute bottom-0.5 right-0.5 rounded-full bg-brand p-0.5 text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          {soldOut && (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <span className="h-[2px] w-[140%] rotate-45 bg-ink/50" />
                            </span>
                          )}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [g.name]: val }))}
                        title={soldOut ? `${val} — out of stock` : val}
                        className={cn(
                          'rounded-xl border-2 px-4 py-2 text-sm font-semibold transition',
                          active ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand',
                          soldOut && 'text-muted-fg line-through opacity-50',
                        )}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Stock */}
          <div className="mt-5">
            {outOfStock ? (
              <Badge variant="neutral">Out of stock</Badge>
            ) : available <= 5 ? (
              <Badge variant="sale">Only {available} left</Badge>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success"><Check className="h-4 w-4" /> In stock</span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} />
            <Button size="lg" loading={adding} disabled={outOfStock || (hasVariants && !selectedVariant)} onClick={() => handleAdd(false)} className="flex-1 gap-2">
              <ShoppingBag className="h-5 w-5" /> Add to cart
            </Button>
            <Button size="lg" variant="secondary" disabled={outOfStock || (hasVariants && !selectedVariant)} onClick={() => handleAdd(true)}>
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

      {/* Recommendations: complements (co-purchase) then similar items */}
      <FrequentlyBoughtTogether productId={product._id} />
      <RelatedProducts productId={product._id} />
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
