'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Truck, RefreshCcw, ShieldCheck, Gift, Star, Timer,
} from 'lucide-react';
import { Container, SectionHeading, Price, Rating } from '@/components/ui';
import { SITE_NAME } from '@/lib/utils';
import {
  ProductCard, ProductCardSkeleton, productToCard, type ProductCardItem,
} from '@/components/product/ProductCard';
import {
  useFeaturedProductsQuery, useListProductsQuery, useBrandsQuery,
} from '@/store/api/productsApi';
import { useForYouQuery } from '@/store/api/recommendationsApi';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

/* ── Trust strip ─────────────────────────────────────────────────────── */
export function TrustStrip() {
  const items = [
    { icon: <Truck className="h-5 w-5" />, label: 'Free shipping', sub: 'Over $50' },
    { icon: <RefreshCcw className="h-5 w-5" />, label: 'Easy returns', sub: '30 days' },
    { icon: <ShieldCheck className="h-5 w-5" />, label: 'Buyer protection', sub: 'Every order' },
    { icon: <Gift className="h-5 w-5" />, label: 'Rewards', sub: 'On every purchase' },
    { icon: <Star className="h-5 w-5 fill-amber-400 text-amber-400" />, label: '4.9 rating', sub: '12k+ reviews' },
  ];
  return (
    <Container className="py-4">
      <div className="grid grid-cols-2 gap-3 rounded-3xl bg-muted p-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand">{it.icon}</div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">{it.label}</p>
              <p className="text-xs text-muted-fg">{it.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}

/* ── Countdown (client, hydration-safe) ──────────────────────────────── */
function Countdown() {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const p = (n: number) => String(n).padStart(2, '0');
      setLeft(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sale/10 px-3 py-1 font-mono text-xs font-medium text-sale">
      <Timer className="h-3.5 w-3.5" /> {left ?? '––:––:––'}
    </span>
  );
}

/* ── Shared product grid ─────────────────────────────────────────────── */
function Grid({ items, loading, cols = 4, count = 8 }: {
  items: ProductCardItem[]; loading: boolean; cols?: number; count?: number;
}) {
  const colClass = cols === 5
    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
    : cols === 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  return (
    <div className={`grid gap-4 ${colClass}`}>
      {loading
        ? Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)
        : items.slice(0, count).map((it) => <ProductCard key={it.id} item={it} />)}
    </div>
  );
}

/* ── Personalized: recommended for you (recently-viewed + trending) ──── */
export function ForYou() {
  const { ids } = useRecentlyViewed();
  const { data, isLoading } = useForYouQuery({ viewed: ids, limit: 12 });
  const items = (data ?? []).map(productToCard);
  if (!isLoading && items.length === 0) return null;
  return (
    <Container className="py-8">
      <SectionHeading eyebrow="Picked for you" title="Recommended for you" />
      <Grid items={items} loading={isLoading} cols={6} count={12} />
    </Container>
  );
}

/* ── Recently viewed (client-side history) ───────────────────────────── */
export function RecentlyViewed() {
  const { items: viewed } = useRecentlyViewed();
  if (viewed.length === 0) return null;
  const items: ProductCardItem[] = viewed.map((v) => ({
    id: v.id, slug: v.slug, name: v.name, price: v.price, currency: v.currency || 'USD', imageUrl: v.imageUrl,
  }));
  return (
    <Container className="py-8">
      <SectionHeading eyebrow="Pick up where you left off" title="Recently viewed" />
      <Grid items={items} loading={false} cols={6} count={12} />
    </Container>
  );
}

/* ── Deals of the day ────────────────────────────────────────────────── */
export function DealsOfDay() {
  const { data, isLoading } = useListProductsQuery({ sortBy: 'popular', limit: 12 });
  const deals = (data?.data ?? []).map(productToCard).filter((p) => p.compareAt && p.compareAt > p.price);
  if (!isLoading && deals.length === 0) return null;
  return (
    <Container className="py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Deals of the day</h2>
          <Countdown />
        </div>
        <Link href="/search?sortBy=price_asc" className="font-mono text-xs font-medium uppercase tracking-widest text-brand hover:underline">
          All deals →
        </Link>
      </div>
      <Grid items={deals} loading={isLoading} cols={5} count={5} />
    </Container>
  );
}

/* ── Category spotlight rail ─────────────────────────────────────────── */
export function SpotlightRail({ title, sortBy, href }: { title: string; sortBy: string; href: string }) {
  const { data, isLoading } = useListProductsQuery({ sortBy, limit: 6 });
  const items = (data?.data ?? []).map(productToCard);
  if (!isLoading && items.length === 0) return null;
  return (
    <Container className="py-8">
      <SectionHeading
        eyebrow="Popular right now"
        title={title}
        action={<Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">View all <ArrowRight className="h-4 w-4" /></Link>}
      />
      <Grid items={items} loading={isLoading} cols={6} count={6} />
    </Container>
  );
}

/* ── New arrivals (dense 5-up, 10) ───────────────────────────────────── */
export function NewArrivals() {
  const { data, isLoading } = useListProductsQuery({ sortBy: 'newest', limit: 10 });
  const items = (data?.data ?? []).map((p) => ({ ...productToCard(p), isNew: true }));
  if (!isLoading && items.length === 0) return null;
  return (
    <Container className="py-8">
      <SectionHeading
        eyebrow="Just landed"
        title="New arrivals"
        action={<Link href="/search?sortBy=newest" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">View all <ArrowRight className="h-4 w-4" /></Link>}
      />
      <Grid items={items} loading={isLoading} cols={5} count={10} />
    </Container>
  );
}

/* ── Best sellers (ranked horizontal cards) ──────────────────────────── */
export function BestSellers() {
  const { data, isLoading } = useListProductsQuery({ sortBy: 'popular', limit: 8 });
  const items = (data?.data ?? []).map(productToCard);
  if (!isLoading && items.length === 0) return null;
  return (
    <Container className="py-8">
      <SectionHeading eyebrow="Most loved" title="Best sellers" />
      <div className="grid gap-3 sm:grid-cols-2">
        {(isLoading ? [] : items.slice(0, 8)).map((it, i) => (
          <Link
            key={it.id}
            href={`/product/${it.slug}`}
            className="group flex items-center gap-4 rounded-2xl bg-surface p-3 ring-1 ring-line/70 transition hover:shadow-card"
          >
            <span className="w-6 shrink-0 text-center font-display text-lg font-semibold text-line">{i + 1}</span>
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
              {it.imageUrl && <Image src={it.imageUrl} alt={it.name} fill sizes="80px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink group-hover:text-brand">{it.name}</p>
              <div className="mt-1"><Rating value={it.rating} count={it.reviewCount} /></div>
              <div className="mt-1"><Price amount={it.price} compareAt={it.compareAt} currency={it.currency} /></div>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}

/* ── Shop by brand ───────────────────────────────────────────────────── */
export function BrandTiles() {
  const { data, isLoading } = useBrandsQuery();
  const brands = data ?? [];
  if (!isLoading && brands.length === 0) return null;
  return (
    <Container className="py-8">
      <SectionHeading eyebrow="Trusted labels" title="Shop by brand" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(isLoading ? Array.from({ length: 6 }) : brands.slice(0, 6)).map((b: any, i: number) => (
          b ? (
            <Link key={b._id} href={`/b/${b.slug}`} className="flex h-20 items-center justify-center rounded-2xl bg-surface px-4 text-center font-semibold text-ink ring-1 ring-line transition hover:ring-ink">
              {b.name}
            </Link>
          ) : <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    </Container>
  );
}

/* ── Why Suuq + reviews ──────────────────────────────────────────────── */
export function WhyUsReviews() {
  const reviews = [
    { name: 'Amina H.', text: 'Fast delivery and the search actually understands Somali. Love it.', rating: 5 },
    { name: 'Yusuf A.', text: 'Prices are great and checkout took seconds. My new go-to.', rating: 5 },
    { name: 'Layla M.', text: 'Huge selection — found everything for my home in one place.', rating: 4 },
    { name: 'Omar D.', text: 'Returns were painless. Customer support replied same day.', rating: 5 },
  ];
  return (
    <Container className="py-8">
      <div className="rounded-3xl bg-muted p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand">Why {SITE_NAME}</span>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Built for the way you shop.</h2>
            <p className="mt-3 max-w-md text-muted-fg">
              Bilingual smart search, fair prices, buyer protection on every order, and a catalog that spans thousands of categories — all in one calm, fast marketplace.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.name} className="rounded-2xl bg-surface p-4 ring-1 ring-line/70">
                <Rating value={r.rating} />
                <p className="mt-2 text-sm text-ink">“{r.text}”</p>
                <p className="mt-2 text-xs font-semibold text-muted-fg">{r.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}

/* ── Newsletter (indigo gradient) ────────────────────────────────────── */
export function Newsletter() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  return (
    <Container className="py-8">
      <div className="overflow-hidden rounded-3xl bg-brand-gradient px-6 py-10 text-white sm:px-12 sm:py-14">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Get first dibs on drops &amp; deals</h2>
          <p className="mt-2 text-white/85">Join the list — a little inbox joy, no spam.</p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (email.trim()) setDone(true); }}
            className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="focus-ring h-12 flex-1 rounded-full border-0 bg-white/95 px-5 text-ink placeholder:text-muted-fg"
              aria-label="Email address"
            />
            <button type="submit" className="focus-ring h-12 rounded-full bg-ink px-6 font-semibold text-white transition hover:bg-ink/90">
              {done ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>
    </Container>
  );
}
