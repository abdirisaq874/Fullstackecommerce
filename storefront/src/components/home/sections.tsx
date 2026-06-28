'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Container, SectionHeading } from '@/components/ui';
import {
  ProductCard, ProductCardSkeleton, productToCard, type ProductCardItem,
} from '@/components/product/ProductCard';
import {
  useFeaturedProductsQuery, useListProductsQuery, useCategoryTreeQuery, useBrandsQuery,
} from '@/store/api/productsApi';

function Rail({
  eyebrow, title, href, items, loading,
}: {
  eyebrow?: string;
  title: string;
  href: string;
  items: ProductCardItem[];
  loading: boolean;
}) {
  const t = useTranslations('home');
  if (!loading && items.length === 0) return null;
  return (
    <Container className="py-10">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        action={
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
            {t('viewAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items.slice(0, 8).map((it) => <ProductCard key={it.id} item={it} />)}
      </div>
    </Container>
  );
}

export function FeaturedSection() {
  const t = useTranslations('home');
  const { data, isLoading } = useFeaturedProductsQuery(8);
  return (
    <Rail
      eyebrow={t('featuredEyebrow')}
      title={t('featuredTitle')}
      href="/search?featured=true"
      loading={isLoading}
      items={(data ?? []).map(productToCard)}
    />
  );
}

export function NewArrivalsSection() {
  const t = useTranslations('home');
  const { data, isLoading } = useListProductsQuery({ sortBy: 'newest', limit: 8 });
  return (
    <Rail
      eyebrow={t('newEyebrow')}
      title={t('newTitle')}
      href="/search?sortBy=newest"
      loading={isLoading}
      items={(data?.data ?? []).map(productToCard)}
    />
  );
}

export function BestsellersSection() {
  const t = useTranslations('home');
  const { data, isLoading } = useListProductsQuery({ sortBy: 'popular', limit: 8 });
  return (
    <Rail
      eyebrow={t('trendingEyebrow')}
      title={t('bestsellers')}
      href="/search?sortBy=popular"
      loading={isLoading}
      items={(data?.data ?? []).map(productToCard)}
    />
  );
}

export function CategoryGrid() {
  const t = useTranslations('home');
  const { data, isLoading } = useCategoryTreeQuery();
  const cats = (data ?? []).slice(0, 8);
  return (
    <Container className="py-10">
      <SectionHeading eyebrow={t('browseEyebrow')} title={t('byCategory')} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton aspect-[4/3] rounded-2xl" />)
          : cats.map((c) => (
              <Link
                key={c._id}
                href={`/c/${c.slug}`}
                className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border border-line bg-brand-100 p-4 shadow-card transition hover:-translate-y-1 hover:shadow-lift"
              >
                {c.imageUrl && (
                  <Image src={c.imageUrl} alt={c.name} fill className="object-cover transition group-hover:scale-105" sizes="(max-width:768px) 50vw, 25vw" />
                )}
                <span className="relative rounded-full bg-surface/90 px-3 py-1 font-bold backdrop-blur">{c.name}</span>
              </Link>
            ))}
      </div>
    </Container>
  );
}

export function BrandStrip() {
  const t = useTranslations('home');
  const { data, isLoading } = useBrandsQuery();
  const brands = data ?? [];
  if (!isLoading && brands.length === 0) return null;
  return (
    <Container className="py-10">
      <SectionHeading eyebrow={t('brandsEyebrow')} title={t('brandsTitle')} />
      <div className="flex flex-wrap gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-12 w-32 rounded-full" />)
          : brands.map((b) => (
              <Link
                key={b._id}
                href={`/b/${b.slug}`}
                className="flex h-12 items-center gap-2 rounded-full border-2 border-line bg-surface px-5 font-bold transition hover:border-brand hover:text-brand"
              >
                {b.logoUrl && <Image src={b.logoUrl} alt={b.name} width={24} height={24} className="rounded-full object-contain" />}
                {b.name}
              </Link>
            ))}
      </div>
    </Container>
  );
}
