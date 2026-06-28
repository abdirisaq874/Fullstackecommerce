'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { SlidersHorizontal, X, Search as SearchIcon, PackageSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Container, EmptyState, Input } from '@/components/ui';
import { ProductCard, ProductCardSkeleton, productToCard, searchHitToCard } from '@/components/product/ProductCard';
import {
  useSmartSearchQuery, useListProductsQuery, useCategoryTreeQuery, useBrandsQuery,
} from '@/store/api/productsApi';

const SORTS = [
  { value: '', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popular', label: 'Bestselling' },
];
const RATINGS = [4, 3, 2];
const PAGE_SIZE = 24;

export function ProductListing({
  fixedCategory, fixedBrand, heading,
}: {
  fixedCategory?: string;
  fixedBrand?: string;
  heading?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = params.get('q') ?? undefined;
  const sortBy = params.get('sortBy') ?? '';
  const category = fixedCategory ?? params.get('category') ?? undefined;
  const brand = fixedBrand ?? params.get('brand') ?? undefined;
  const priceMin = params.get('priceMin') ? Number(params.get('priceMin')) : undefined;
  const priceMax = params.get('priceMax') ? Number(params.get('priceMax')) : undefined;
  const rating = params.get('rating') ? Number(params.get('rating')) : undefined;
  const page = params.get('page') ? Number(params.get('page')) : 1;

  const locale = useLocale();
  // Smart multilingual search first; gracefully fall back to /products if the
  // search service is unavailable (e.g. OpenSearch not running).
  const smart = useSmartSearchQuery({
    q, locale, category, brand, priceMin, priceMax, rating, sort: sortBy || undefined, page, limit: PAGE_SIZE,
  });
  const useFallback = smart.isError;
  const fallback = useListProductsQuery(
    { q, category, brand, priceMin, priceMax, rating, sortBy: sortBy || undefined, page, limit: PAGE_SIZE },
    { skip: !useFallback },
  );

  const { data: categories } = useCategoryTreeQuery();
  const { data: brands } = useBrandsQuery();

  const isFetching = useFallback ? fallback.isFetching : smart.isFetching;

  const setParam = useCallback(
    (next: Record<string, string | undefined>, resetPage = true) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      if (resetPage) sp.delete('page');
      router.push(`${pathname}?${sp.toString()}`);
    },
    [params, pathname, router],
  );

  const total = useFallback ? (fallback.data?.meta.total ?? 0) : (smart.data?.meta.total ?? 0);
  const totalPages = useFallback ? (fallback.data?.meta.totalPages ?? 1) : (smart.data?.meta.totalPages ?? 1);
  const items = useFallback
    ? (fallback.data?.data ?? []).map(productToCard)
    : (smart.data?.data ?? []).map(searchHitToCard);

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (q) chips.push({ label: `“${q}”`, clear: () => setParam({ q: undefined }) });
    if (!fixedCategory && category) chips.push({ label: category, clear: () => setParam({ category: undefined }) });
    if (!fixedBrand && brand) chips.push({ label: brand, clear: () => setParam({ brand: undefined }) });
    if (priceMin || priceMax) chips.push({ label: `$${priceMin ?? 0}–${priceMax ?? '∞'}`, clear: () => setParam({ priceMin: undefined, priceMax: undefined }) });
    if (rating) chips.push({ label: `${rating}★ & up`, clear: () => setParam({ rating: undefined }) });
    return chips;
  }, [q, category, brand, priceMin, priceMax, rating, fixedCategory, fixedBrand, setParam]);

  const prettify = (s?: string) => s?.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const catName = fixedCategory ? (categories ?? []).find((c) => c.slug === fixedCategory)?.name : undefined;
  const brandName = fixedBrand ? (brands ?? []).find((b) => b.slug === fixedBrand)?.name : undefined;
  const title =
    heading || catName || brandName || prettify(fixedCategory) || prettify(fixedBrand) ||
    (q ? `Results for “${q}”` : 'All products');

  const Filters = (
    <div className="space-y-7">
      {!fixedCategory && (categories?.length ?? 0) > 0 && (
        <FilterGroup title="Category">
          <div className="space-y-1">
            {(categories ?? []).slice(0, 12).map((c) => (
              <FilterOption key={c._id} active={category === c.slug} onClick={() => setParam({ category: category === c.slug ? undefined : c.slug })}>
                {c.name}
              </FilterOption>
            ))}
          </div>
        </FilterGroup>
      )}
      {!fixedBrand && (brands?.length ?? 0) > 0 && (
        <FilterGroup title="Brand">
          <div className="space-y-1">
            {(brands ?? []).slice(0, 12).map((b) => (
              <FilterOption key={b._id} active={brand === b.slug} onClick={() => setParam({ brand: brand === b.slug ? undefined : b.slug })}>
                {b.name}
              </FilterOption>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Price">
        <PriceFilter min={priceMin} max={priceMax} onApply={(mn, mx) => setParam({ priceMin: mn, priceMax: mx })} />
      </FilterGroup>
      <FilterGroup title="Rating">
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => (
            <button
              key={r}
              onClick={() => setParam({ rating: rating === r ? undefined : String(r) })}
              className={cn('rounded-full border-2 px-3 py-1 text-sm font-semibold transition', rating === r ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand')}
            >
              {r}★ & up
            </button>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <Container className="py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm text-muted-fg">{total} {total === 1 ? 'product' : 'products'}</p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </Button>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {activeChips.map((chip, i) => (
            <button key={i} onClick={chip.clear} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold hover:bg-muted/70">
              {chip.label} <X className="h-3.5 w-3.5" />
            </button>
          ))}
          {activeChips.length > 0 && (
            <button onClick={() => router.push(pathname)} className="text-sm font-bold text-accent hover:underline">Clear all</button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden font-semibold text-muted-fg sm:inline">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setParam({ sortBy: e.target.value })}
            className="focus-ring h-10 rounded-xl border-2 border-line bg-surface px-3 font-semibold"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Desktop filters */}
        <aside className="hidden lg:block">{Filters}</aside>

        {/* Results */}
        <div>
          {isFetching ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-10 w-10" />}
              title="No products found"
              description="Try adjusting your filters or search for something else."
              action={<Button onClick={() => router.push(pathname)}>Clear filters</Button>}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {items.map((it) => <ProductCard key={it.id} item={it} />)}
              </div>
              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onPage={(p) => setParam({ page: String(p) }, false)} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto bg-surface p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="focus-ring grid h-10 w-10 place-items-center rounded-lg" aria-label="Close"><X className="h-6 w-6" /></button>
            </div>
            {Filters}
            <Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>Show {total} results</Button>
          </div>
        </div>
      )}
    </Container>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm font-medium transition', active ? 'bg-brand text-white' : 'hover:bg-muted')}>
      {children}
    </button>
  );
}

function PriceFilter({ min, max, onApply }: { min?: number; max?: number; onApply: (mn?: string, mx?: string) => void }) {
  const [lo, setLo] = useState(min?.toString() ?? '');
  const [hi, setHi] = useState(max?.toString() ?? '');
  return (
    <div className="flex items-end gap-2">
      <Input type="number" placeholder="Min" value={lo} onChange={(e) => setLo(e.target.value)} className="h-10" />
      <Input type="number" placeholder="Max" value={hi} onChange={(e) => setHi(e.target.value)} className="h-10" />
      <Button size="sm" variant="outline" className="h-10" onClick={() => onApply(lo || undefined, hi || undefined)}>Go</Button>
    </div>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
      {pages.map((p, i) => {
        const gap = i > 0 && p - pages[i - 1] > 1;
        return (
          <span key={p} className="flex items-center">
            {gap && <span className="px-1 text-muted-fg">…</span>}
            <button
              onClick={() => onPage(p)}
              className={cn('h-9 min-w-9 rounded-lg px-3 text-sm font-bold transition', p === page ? 'bg-brand-gradient text-white shadow-pop' : 'hover:bg-muted')}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          </span>
        );
      })}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
    </nav>
  );
}
