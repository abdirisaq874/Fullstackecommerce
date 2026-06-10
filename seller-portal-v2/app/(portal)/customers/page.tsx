'use client';

/**
 * /customers — paginated list of buyers who have purchased from this seller.
 *
 * Data: `GET /seller/customers` (see `lib/api/customers-api.ts`). Aggregated
 * server-side from Order + Product + User collections, so each row already
 * carries orderCount / lifetimeValue / lastOrderAt.
 *
 * URL state: `?page=`, `?search=`, `?sortBy=`, `?sortDir=` are the source of
 * truth so the page is deep-linkable + back/forward-friendly. Local state
 * mirrors `?search` only to drive a 300ms debounce — every other interaction
 * round-trips through `router.replace()`.
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Input, Select } from '@/components/primitives/field';
// TODO (H5): migrate this page to <ResponsiveTable> so rows collapse to cards
// below the md breakpoint — see /orders and /products for the pattern.
import { DataTable, type Column } from '@/components/data/data-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import {
  useListCustomersQuery,
  type CustomerSortField,
  type SellerCustomer,
  type SortDirection,
} from '@/lib/api';
import { countryFlag } from '@/lib/utils';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS: Array<{ value: `${CustomerSortField}:${SortDirection}`; label: string }> = [
  { value: 'lastOrderAt:desc',   label: 'Last order · newest first' },
  { value: 'lastOrderAt:asc',    label: 'Last order · oldest first' },
  { value: 'lifetimeValue:desc', label: 'Lifetime value · highest first' },
  { value: 'lifetimeValue:asc',  label: 'Lifetime value · lowest first' },
  { value: 'orderCount:desc',    label: 'Order count · most first' },
  { value: 'orderCount:asc',     label: 'Order count · fewest first' },
];

const VALID_SORT_FIELDS: CustomerSortField[] = ['lastOrderAt', 'lifetimeValue', 'orderCount'];
const VALID_SORT_DIRS: SortDirection[] = ['asc', 'desc'];

function clampSortField(value: string | null): CustomerSortField {
  return (VALID_SORT_FIELDS as string[]).includes(value ?? '')
    ? (value as CustomerSortField)
    : 'lastOrderAt';
}

function clampSortDir(value: string | null): SortDirection {
  return (VALID_SORT_DIRS as string[]).includes(value ?? '')
    ? (value as SortDirection)
    : 'desc';
}

function clampPage(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Format an integer minor-unit amount (e.g. cents) or major-unit number into
 * "$1,234.56". The backend aggregation sums `Order.items[].totalPrice` which is
 * already in the order's display currency unit — we treat the value as a
 * major-unit amount for display. Multi-currency is intentionally left for
 * a follow-up once the backend exposes per-currency LTV.
 */
function formatMoney(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/**
 * Human-friendly relative-time formatter using `Intl.RelativeTimeFormat`.
 * Falls back to a short absolute date for anything older than a week or for
 * un-parseable input.
 */
function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absSec < 60) return rtf.format(diffSec, 'second');
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (absSec < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (absSec < 604_800) return rtf.format(Math.round(diffSec / 86_400), 'day');
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Country flag heuristic — the customer aggregation does not yet return a
 * country code (the User schema doesn't store one). For now we surface a
 * dash; once the backend joins the user's most-recent shipping address into
 * the response, this can switch to a real country code via `countryFlag()`.
 */
function customerCountryGlyph(_customer: SellerCustomer): string {
  // TODO(backend): include the buyer's primary country (e.g. from the last
  // shipping address) in the SellerCustomer projection so we can render a flag.
  void countryFlag; // keep the import for the future wiring
  return '—';
}

function CustomersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = clampPage(searchParams.get('page'));
  const sortBy = clampSortField(searchParams.get('sortBy'));
  const sortDir = clampSortDir(searchParams.get('sortDir'));
  const urlSearch = searchParams.get('search') ?? '';

  // Local input value mirrors the URL but is debounced before being written back.
  const [searchInput, setSearchInput] = useState(urlSearch);

  // If the URL changes externally (back/forward, deep link), keep the input in sync.
  useEffect(() => {
    setSearchInput(urlSearch);
    // We intentionally only react to the URL's value — not the local input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  // Debounce search input → URL.
  useEffect(() => {
    if (searchInput === urlSearch) return;
    const t = setTimeout(() => {
      updateParams({ search: searchInput || undefined, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // updateParams is stable enough for this scope; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, urlSearch]);

  function updateParams(patch: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    router.replace(`/customers${next.toString() ? `?${next.toString()}` : ''}`);
  }

  const { data, isLoading, isFetching, isError, refetch } = useListCustomersQuery({
    page,
    limit: PAGE_SIZE,
    search: urlSearch || undefined,
    sortBy,
    sortDir,
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;

  const columns: Column<SellerCustomer>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (c) => (
          <div className="min-w-0">
            <div className="text-sm font-medium text-stone-900 truncate">
              {c.fullName?.trim() || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'}
            </div>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        render: (c) => (
          <span className="text-sm text-stone-600 truncate inline-block max-w-[260px]">
            {c.email || '—'}
          </span>
        ),
      },
      {
        key: 'country',
        header: 'Country',
        render: (c) => <span className="text-sm text-stone-500">{customerCountryGlyph(c)}</span>,
      },
      {
        key: 'orderCount',
        header: 'Orders',
        render: (c) => <span className="tabular-nums text-stone-700">{c.orderCount}</span>,
      },
      {
        key: 'lifetimeValue',
        header: 'Lifetime value',
        render: (c) => (
          <span className="font-medium tabular-nums text-stone-900">{formatMoney(c.lifetimeValue)}</span>
        ),
      },
      {
        key: 'lastOrderAt',
        header: 'Last order',
        render: (c) => (
          <span className="text-xs text-stone-500">{formatRelativeTime(c.lastOrderAt)}</span>
        ),
      },
    ],
    [],
  );

  const currentSortValue: `${CustomerSortField}:${SortDirection}` = `${sortBy}:${sortDir}`;

  const headerSubtitle = meta
    ? `${meta.total.toLocaleString()} customer${meta.total === 1 ? '' : 's'} · page ${meta.page} of ${Math.max(1, meta.totalPages)}`
    : 'Buyers who have purchased from your store';

  return (
    <>
      <PageHeader title="Customers" subtitle={headerSubtitle} />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              className="!pl-9"
              aria-label="Search customers"
            />
          </div>
          <Select
            value={currentSortValue}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(':') as [CustomerSortField, SortDirection];
              updateParams({ sortBy: field, sortDir: dir, page: 1 });
            }}
            aria-label="Sort customers"
            className="!w-auto"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isError ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={urlSearch ? 'No customers match that search' : 'No customers yet'}
            description={
              urlSearch
                ? 'Try a different name or email, or clear the search.'
                : 'Once buyers place orders that include items from your store, they will appear here.'
            }
          />
        ) : (
          <DataTable<SellerCustomer>
            columns={columns}
            data={customers}
            rowKey={(c) => c.userId}
            onRowClick={(c) => router.push(`/customers/${c.userId}`)}
          />
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-3">
            <div className="text-xs text-stone-500">
              Showing {(meta.page - 1) * meta.limit + 1}–
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => updateParams({ page: Math.max(1, meta.page - 1) })}
                disabled={!meta.hasPrev || isFetching}
                size="sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <span className="text-xs text-stone-500 tabular-nums">
                Page {meta.page} / {meta.totalPages}
              </span>
              <Button
                onClick={() => updateParams({ page: meta.page + 1 })}
                disabled={!meta.hasNext || isFetching}
                size="sm"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

/**
 * `useSearchParams()` requires a Suspense boundary in Next 14 App Router for
 * pages that opt out of static rendering, so wrap the actual page body.
 */
export default function CustomersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} columns={6} />}>
      <CustomersPageInner />
    </Suspense>
  );
}
