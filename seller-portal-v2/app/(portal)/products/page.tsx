'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Filter, Upload, Download, Archive, Star, StarOff, Search, MoreHorizontal, X, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Field, Input, Select } from '@/components/primitives/field';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/data/responsive-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { CsvImportModal } from '@/components/product/csv-import-modal';
import { ConfirmDialog } from '@/components/primitives/confirm-dialog';
import { Money } from '@/components/shared/format';
import { useListProductsQuery, useBulkUpdateProductsMutation, useArchiveProductMutation, useBulkCreateProductsMutation, useGetCategoriesQuery, useGetBrandsQuery } from '@/lib/api';
import { useAppSelector } from '@/lib/api/store';
import { useToast } from '@/lib/hooks/use-toast';
import { productDisplayStatus, toCSV, downloadCSV } from '@/lib/utils';
import { CATEGORIES } from '@/lib/config/reference-data';
import type { Product } from '@/lib/types';
import clsx from 'clsx';

export default function ProductsPage() {
  const router = useRouter();
  // Scope the list to the signed-in seller — GET /products is the shared public
  // catalog, so without a sellerId it returns every store's products.
  const sellerId = useAppSelector((s) => s.auth.user?._id);
  // The backend's GET /products returns a single status per call (no "all" mode),
  // so we fetch each status and merge — this powers the All/Active/Drafts/Archived
  // tabs and their counts. (Mongo returns `_id`; map it to the `id` the UI expects.)
  const activeQ = useListProductsQuery({ status: 'active', limit: 100, sellerId }, { skip: !sellerId });
  const draftQ = useListProductsQuery({ status: 'draft', limit: 100, sellerId }, { skip: !sellerId });
  const archivedQ = useListProductsQuery({ status: 'archived', limit: 100, sellerId }, { skip: !sellerId });
  const products = useMemo<Product[]>(() => {
    const withId = (arr?: Product[]) =>
      (arr ?? []).map(p => ({ ...p, id: p.id ?? (p as unknown as { _id?: string })._id ?? '' }));
    return [...withId(activeQ.data), ...withId(draftQ.data), ...withId(archivedQ.data)];
  }, [activeQ.data, draftQ.data, archivedQ.data]);
  const isLoading = !sellerId || activeQ.isLoading || draftQ.isLoading || archivedQ.isLoading;
  // Only show the error screen if EVERY query failed — one failed status must not
  // blank the whole page (it shows whatever did load).
  const isError = activeQ.isError && draftQ.isError && archivedQ.isError;
  const refetch = () => { activeQ.refetch(); draftQ.refetch(); archivedQ.refetch(); };
  const [bulkUpdate, { isLoading: bulking }] = useBulkUpdateProductsMutation();
  const [archive] = useArchiveProductMutation();
  const [bulkCreateProducts] = useBulkCreateProductsMutation();
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [csvOpen, setCsvOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<null | {
    title: string;
    message: ReactNode;
    confirmLabel: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => Promise<void> | void;
  }>(null);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, statusFilter, categoryFilter, search]);

  const statusCounts = useMemo(() => ({
    all: products.length,
    active: products.filter(p => p.status === 'active').length,
    draft: products.filter(p => p.status === 'draft').length,
    archived: products.filter(p => p.status === 'archived').length,
  }), [products]);

  const handleSelect = (id: string, checked: boolean) => {
    setSelected(s => {
      const n = new Set(s);
      if (checked) n.add(id); else n.delete(id);
      return n;
    });
  };
  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map(p => p.id)) : new Set());
  };

  const bulkArchive = () => setPendingConfirm({
    title: 'Archive products',
    message: `Archive ${selected.size} product${selected.size === 1 ? '' : 's'}? They’ll be hidden from the storefront — you can republish them later.`,
    confirmLabel: 'Archive',
    variant: 'danger',
    onConfirm: async () => {
      await bulkUpdate({ ids: Array.from(selected), patch: { status: 'archived' } });
      toast.success(`${selected.size} products archived`);
      setSelected(new Set());
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
      setSelected(new Set());
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
      setSelected(new Set());
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
      setSelected(new Set());
    },
  });

  const exportCsv = () => {
    const rows = (selected.size ? filtered.filter(p => selected.has(p.id)) : filtered).map(p => ({
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

  const handleImport = async (rows: Record<string, string>[]) => {
    // Resolve CSV category/brand NAMES to real Mongo ObjectIds (case-insensitive).
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c._id]));
    const brandByName = new Map(brands.map((b) => [b.name.toLowerCase().trim(), b._id]));
    const valid = rows.filter((r) => r.name && r.basePrice);
    const products = valid.map((r) => ({
      name: r.name,
      basePrice: Number(r.basePrice),
      compareAtPrice: r.compareAtPrice ? Number(r.compareAtPrice) : undefined,
      categoryId: r.categoryName ? catByName.get(r.categoryName.toLowerCase().trim()) : undefined,
      brandId: r.brandName ? brandByName.get(r.brandName.toLowerCase().trim()) : undefined,
      shortDescription: r.shortDescription || undefined,
      description: r.description || undefined,
      stock: r.stockOnHand ? Number(r.stockOnHand) || 0 : undefined,
      // Image column → one or more images (pipe-separated url1|url2|url3); first is primary.
      images: r.imageUrl
        ? r.imageUrl.split('|').map((u) => u.trim()).filter(Boolean)
            .map((url, idx) => ({ url, altText: r.name, isPrimary: idx === 0, sortOrder: idx }))
        : undefined,
      status: 'draft' as const,
    }));
    // One request per ~100 products — a large import (e.g. 400) stays well under
    // the backend's global rate limit (vs. one request per row).
    let created = 0, failed = rows.length - products.length;
    const CHUNK = 100;
    for (let i = 0; i < products.length; i += CHUNK) {
      const batch = products.slice(i, i + CHUNK);
      try {
        const res = await bulkCreateProducts({ products: batch }).unwrap();
        created += res.created; failed += res.failed;
      } catch {
        failed += batch.length;
      }
    }
    if (created) toast.success(`Imported ${created} product${created === 1 ? '' : 's'} as drafts${failed ? ` · ${failed} failed/skipped` : ''}`);
    else         toast.error(`Import failed — 0 of ${rows.length} products created`);
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

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${products.length} total · ${statusCounts.active} active`}
        actions={
          <>
            <Button onClick={() => setCsvOpen(true)}><Upload className="w-3.5 h-3.5" /> Import CSV</Button>
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
                onClick={() => setStatusFilter(opt.v)}
                className={clsx(
                  'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5',
                  statusFilter === opt.v ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900'
                )}
              >
                {opt.label}
                <span className="text-stone-400">{opt.count}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="!pl-9"
            />
          </div>
          <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="!w-auto">
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
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No products found"
            description={search || statusFilter !== 'all' || categoryFilter ? 'Try adjusting your filters.' : 'Start building your catalog by adding your first product.'}
            action={<Button variant="primary" onClick={() => router.push('/products/new')}><Plus className="w-3.5 h-3.5" /> Add product</Button>}
          />
        ) : (
          <ResponsiveTable
            columns={columns}
            data={filtered}
            rowKey={p => p.id}
            selectable
            selectedIds={selected}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onRowClick={(p) => router.push(`/products/${p.id}/edit`)}
          />
        )}
      </Card>

      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} onImport={handleImport} />

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
