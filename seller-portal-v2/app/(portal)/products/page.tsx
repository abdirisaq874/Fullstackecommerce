'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Upload, Download, Archive, Star, StarOff, Search, X, BarChart3, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Input, Select } from '@/components/primitives/field';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/data/responsive-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { BulkImportModal } from '@/components/product/bulk-import-modal';
import { ConfirmDialog } from '@/components/primitives/confirm-dialog';
import { Money } from '@/components/shared/format';
import { useListProductsPageQuery, useBulkUpdateProductsMutation } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';
import { productDisplayStatus, toCSV, downloadCSV } from '@/lib/utils';
import { CATEGORIES } from '@/lib/config/reference-data';
import type { Product } from '@/lib/types';
import clsx from 'clsx';

type StatusFilter = 'all' | 'active' | 'draft' | 'archived';
const PER_PAGE_OPTIONS = [25, 50, 100];
const DEFAULT_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // --- URL-driven view state (survives refresh / is shareable) ---------------
  const status = ((sp.get('status') as StatusFilter) || 'all');
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const perPage = PER_PAGE_OPTIONS.includes(Number(sp.get('perPage'))) ? Number(sp.get('perPage')) : DEFAULT_PER_PAGE;
  const qParam = sp.get('q') || '';
  const category = sp.get('category') || '';

  const setParams = (updates: Record<string, string | undefined>, resetPage = false) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k); else next.set(k, v);
    }
    if (resetPage) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  };

  // Search box is local + debounced so we don't rewrite the URL on every keystroke.
  const [searchInput, setSearchInput] = useState(qParam);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== qParam) setParams({ q: searchInput || undefined }, true);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // --- data ------------------------------------------------------------------
  const commonFilter = { search: qParam || undefined, categoryId: category || undefined };
  // The visible page for the current tab.
  const listQ = useListProductsPageQuery({
    status: status === 'all' ? undefined : status,
    page,
    limit: perPage,
    ...commonFilter,
  });
  // Tiny count-only queries (limit 1) — read the server's TRUE per-status totals
  // for the tab badges + header, honouring the active search/category filter.
  const activeCntQ = useListProductsPageQuery({ status: 'active', limit: 1, ...commonFilter });
  const draftCntQ = useListProductsPageQuery({ status: 'draft', limit: 1, ...commonFilter });
  const archivedCntQ = useListProductsPageQuery({ status: 'archived', limit: 1, ...commonFilter });

  const cActive = activeCntQ.data?.total ?? 0;
  const cDraft = draftCntQ.data?.total ?? 0;
  const cArchived = archivedCntQ.data?.total ?? 0;
  const cAll = cActive + cDraft + cArchived;
  const statusCounts = { all: cAll, active: cActive, draft: cDraft, archived: cArchived };

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, listQ.data?.totalPages ?? 1);
  const isLoading = listQ.isLoading || listQ.isFetching;
  const isError = listQ.isError;
  const refetch = () => { listQ.refetch(); activeCntQ.refetch(); draftCntQ.refetch(); archivedCntQ.refetch(); };

  const [bulkUpdate, { isLoading: bulking }] = useBulkUpdateProductsMutation();
  const toast = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [csvOpen, setCsvOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<null | {
    title: string;
    message: ReactNode;
    confirmLabel: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => Promise<void> | void;
  }>(null);

  const handleSelect = (id: string, checked: boolean) => {
    setSelected(s => {
      const n = new Set(s);
      if (checked) n.add(id); else n.delete(id);
      return n;
    });
  };
  const handleSelectAll = (checked: boolean) => {
    // Select/clear the CURRENT page's rows (selection can still span pages).
    setSelected(s => {
      const n = new Set(s);
      for (const p of items) { if (checked) n.add(p.id); else n.delete(p.id); }
      return n;
    });
  };

  const afterBulk = () => { setSelected(new Set()); };

  const bulkArchive = () => setPendingConfirm({
    title: 'Archive products',
    message: `Archive ${selected.size} product${selected.size === 1 ? '' : 's'}? They’ll be hidden from the storefront — you can republish them later.`,
    confirmLabel: 'Archive',
    variant: 'danger',
    onConfirm: async () => {
      await bulkUpdate({ ids: Array.from(selected), patch: { status: 'archived' } });
      toast.success(`${selected.size} products archived`);
      afterBulk();
    },
  });
  const bulkFeature = () => setPendingConfirm({
    title: 'Feature products',
    message: `Feature ${selected.size} product${selected.size === 1 ? '' : 's'}? They’ll appear in curated areas like the homepage.`,
    confirmLabel: 'Feature',
    variant: 'primary',
    onConfirm: async () => {
      await bulkUpdate({ ids: Array.from(selected), patch: { isFeatured: true } });
      toast.success(`${selected.size} products featured`);
      afterBulk();
    },
  });
  const bulkUnfeature = () => setPendingConfirm({
    title: 'Remove from featured',
    message: `Remove ${selected.size} product${selected.size === 1 ? '' : 's'} from featured areas? They’ll stay published, just no longer highlighted.`,
    confirmLabel: 'Unfeature',
    variant: 'primary',
    onConfirm: async () => {
      await bulkUpdate({ ids: Array.from(selected), patch: { isFeatured: false } });
      toast.success(`${selected.size} products unfeatured`);
      afterBulk();
    },
  });
  const bulkPublish = () => setPendingConfirm({
    title: 'Publish products',
    message: `Publish ${selected.size} product${selected.size === 1 ? '' : 's'}? They’ll go live on the storefront immediately.`,
    confirmLabel: 'Publish',
    variant: 'primary',
    onConfirm: async () => {
      await bulkUpdate({ ids: Array.from(selected), patch: { status: 'active' } });
      toast.success(`${selected.size} products published`);
      afterBulk();
    },
  });

  // Exports the current page (or the selected rows on it). For a full-catalog
  // export we'd page through server-side; kept to the loaded rows for now.
  const exportCsv = () => {
    const source = selected.size ? items.filter(p => selected.has(p.id)) : items;
    const rows = source.map(p => ({
      sku: p.sku, name: p.name, basePrice: p.basePrice, status: p.status,
      stock: p.stock ?? '', categoryId: p.categoryId ?? '', totalSold: p.totalSold,
    }));
    const csv = toCSV(rows, [
      { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' },
      { key: 'basePrice', label: 'Base price' }, { key: 'status', label: 'Status' },
      { key: 'stock', label: 'Stock' }, { key: 'categoryId', label: 'Category' },
      { key: 'totalSold', label: 'Lifetime sales' },
    ]);
    downloadCSV(`products-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${rows.length} products`);
  };

  const columns: ResponsiveColumn<Product>[] = [
    {
      key: 'name', header: 'Product', className: 'min-w-[280px]', mobilePrimary: true,
      render: (p) => (
        <Link href={`/products/${p.id}/edit`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-md overflow-hidden bg-stone-100 grid place-items-center shrink-0 ring-1 ring-stone-200">
            {p.images?.[0]?.url
              ? <Image src={p.images[0].url} alt={p.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
              : <span className="font-serif text-base text-stone-500">{p.initial ?? p.name[0]}</span>}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-stone-900 font-medium truncate group-hover:text-brand-700">{p.name}</div>
            <div className="text-xs text-stone-500 font-mono">{p.sku}</div>
          </div>
        </Link>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => <span className="text-stone-600">{(p.categoryId as unknown as { name?: string })?.name ?? '—'}</span> },
    { key: 'brand',    header: 'Brand',    render: (p) => <span className="text-stone-600">{(p.brandId as unknown as { name?: string })?.name ?? '—'}</span> },
    {
      key: 'price', header: 'Price', className: 'text-right',
      render: (p) => (
        <div className="text-right">
          <div className="font-medium tabular-nums"><Money value={p.basePrice} currency={p.currency} /></div>
          {p.compareAtPrice && <div className="text-xs text-stone-400 line-through tabular-nums"><Money value={p.compareAtPrice} currency={p.currency} /></div>}
        </div>
      ),
    },
    {
      key: 'stock', header: 'Stock', className: 'text-right',
      render: (p) => (
        <span className={clsx('tabular-nums text-sm', p.stock === 0 ? 'text-red-600 font-medium' : p.stock !== null && p.stock <= 5 ? 'text-amber-700' : 'text-stone-700')}>
          {p.stock ?? '—'}
        </span>
      ),
    },
    {
      key: 'sales', header: 'Sales', className: 'text-right',
      render: (p) => <span className="tabular-nums text-sm text-stone-600">{p.totalSold}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (p) => {
        const s = productDisplayStatus(p);
        return (
          <div className="flex items-center gap-2">
            <Badge variant={s.variant}>{s.label}</Badge>
            {p.isFeatured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
          </div>
        );
      },
    },
    { key: 'updated', header: 'Updated', render: (p) => <span className="text-xs text-stone-500">{p.updatedAt}</span> },
    {
      key: 'actions', header: '', className: 'w-12', mobileHidden: true,
      render: (p) => (
        <button
          type="button"
          className="text-stone-400 hover:text-stone-700 p-1"
          onClick={(e) => { e.stopPropagation(); router.push(`/products/${p.id}/analytics`); }}
          title="Open analytics"
          aria-label={`Open analytics for ${p.name}`}
        >
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
        </button>
      ),
    },
  ];

  // Windowed page numbers: first, last, and the current ±1 (ellipsis for gaps).
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1),
    [totalPages, page],
  );
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${cAll.toLocaleString()} total · ${cActive.toLocaleString()} active`}
        actions={
          <>
            <Button onClick={() => setCsvOpen(true)}><Upload className="w-3.5 h-3.5" /> Bulk import</Button>
            <Button onClick={() => router.push('/products/imports')}><History className="w-3.5 h-3.5" /> Import history</Button>
            <Button onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export</Button>
            <Button variant="primary" onClick={() => router.push('/products/new')}>
              <Plus className="w-3.5 h-3.5" /> Add product
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
            {([
              { v: 'all', label: 'All', count: statusCounts.all },
              { v: 'active', label: 'Active', count: statusCounts.active },
              { v: 'draft', label: 'Drafts', count: statusCounts.draft },
              { v: 'archived', label: 'Archived', count: statusCounts.archived },
            ] as const).map(opt => (
              <button
                key={opt.v}
                onClick={() => setParams({ status: opt.v === 'all' ? undefined : opt.v }, true)}
                className={clsx(
                  'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5',
                  status === opt.v ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900'
                )}
              >
                {opt.label}
                <span className="text-stone-400">{opt.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by name or SKU…"
              className="!pl-9"
            />
          </div>
          <Select value={category} onChange={e => setParams({ category: e.target.value || undefined }, true)} className="!w-auto">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="mb-4 p-3 bg-brand-50/40 border-brand-200">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-brand-900 font-medium">
              {selected.size} selected
            </div>
            <div className="h-4 w-px bg-brand-200" />
            <Button onClick={bulkPublish} disabled={bulking}>Publish</Button>
            <Button onClick={bulkFeature} disabled={bulking}><Star className="w-3.5 h-3.5" /> Feature</Button>
            <Button onClick={bulkUnfeature} disabled={bulking}><StarOff className="w-3.5 h-3.5" /> Unfeature</Button>
            <Button onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export selected</Button>
            <Button variant="danger-ghost" onClick={bulkArchive} disabled={bulking}><Archive className="w-3.5 h-3.5" /> Archive</Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-stone-500 hover:text-stone-900 p-1"
              aria-label="Clear product selection"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} columns={8} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No products found"
            description={qParam || status !== 'all' || category ? 'Try adjusting your filters.' : 'Start building your catalog by adding your first product.'}
            action={<Button variant="primary" onClick={() => router.push('/products/new')}><Plus className="w-3.5 h-3.5" /> Add product</Button>}
          />
        ) : (
          <>
            <ResponsiveTable
              columns={columns}
              data={items}
              rowKey={p => p.id}
              selectable
              selectedIds={selected}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onRowClick={(p) => router.push(`/products/${p.id}/edit`)}
            />

            {/* Pager */}
            <div className="flex items-center justify-between gap-3 flex-wrap border-t border-stone-200 px-4 py-3">
              <div className="text-xs text-stone-500 tabular-nums">
                Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-stone-500">
                  Per page
                  <Select
                    value={String(perPage)}
                    onChange={e => setParams({ perPage: e.target.value }, true)}
                    className="!w-auto !py-1"
                  >
                    {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </label>

                {totalPages > 1 && (
                  <nav className="flex items-center gap-1" aria-label="Pagination">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setParams({ page: String(page - 1) })}
                      className="p-1.5 rounded text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {pageNumbers.map((p, i) => {
                      const gap = i > 0 && p - pageNumbers[i - 1] > 1;
                      return (
                        <span key={p} className="flex items-center">
                          {gap && <span className="px-1 text-stone-400">…</span>}
                          <button
                            type="button"
                            onClick={() => setParams({ page: String(p) })}
                            aria-current={p === page ? 'page' : undefined}
                            className={clsx(
                              'min-w-[2rem] px-2 py-1 rounded text-sm tabular-nums',
                              p === page ? 'bg-brand-700 text-white font-medium' : 'text-stone-600 hover:bg-stone-100'
                            )}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setParams({ page: String(page + 1) })}
                      className="p-1.5 rounded text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </nav>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      <BulkImportModal open={csvOpen} onClose={() => setCsvOpen(false)} onDone={refetch} />

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message}
        confirmLabel={pendingConfirm?.confirmLabel}
        variant={pendingConfirm?.variant}
        loading={bulking}
        onConfirm={async () => { await pendingConfirm?.onConfirm(); setPendingConfirm(null); }}
        onClose={() => setPendingConfirm(null)}
      />
    </>
  );
}