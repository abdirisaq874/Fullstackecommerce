/**
 * Marketing — coupons CRUD (E3).
 *
 * Wires the admin coupon endpoints (`admin/coupons.controller.ts`) into a
 * status-tabbed list. The four tabs (Active / Scheduled / Expired / All) map
 * to the `CouponStatusFilter` accepted by `useListCouponsQuery`. The server
 * narrows by `isActive` where possible; we additionally post-filter
 * client-side to apply the date predicate (a coupon with `isActive: true` may
 * still be past `expiresAt`).
 *
 * Row actions:
 *   - Edit: opens the shared `CouponModal` in edit mode. The backend rejects
 *     edits to coupons with redemptions; the field-level disable on `code`
 *     gives an early signal and the API error toast covers the rest.
 *   - Deactivate: PATCH /:id/deactivate (set isActive=false). Always allowed.
 *   - Delete: only safe before any redemptions. If `redemptionsCount > 0` we
 *     swap the prompt to deactivate instead, matching backend semantics.
 */
'use client';

import { useMemo, useState } from 'react';
import { Plus, Tag, Edit2, Trash2, PowerOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Input } from '@/components/primitives/field';
import { DataTable, type Column } from '@/components/data/data-table';
import { TableSkeleton, EmptyState, ErrorState } from '@/components/data/states';
import { CouponModal } from '@/components/marketing/coupon-modal';
import {
  useListCouponsQuery,
  useDeleteCouponMutation,
  useDeactivateCouponMutation,
  couponStatus,
  couponDisplayType,
  type Coupon,
  type CouponStatusFilter,
} from '@/lib/api/coupons-api';
import { formatCurrencyCents, formatDateShort, type BadgeVariant } from '@/lib/utils';

const STATUS_TABS: { v: CouponStatusFilter; label: string }[] = [
  { v: 'active', label: 'Active' },
  { v: 'scheduled', label: 'Scheduled' },
  { v: 'expired', label: 'Expired' },
  { v: 'all', label: 'All' },
];

const STATUS_BADGE: Record<ReturnType<typeof couponStatus>, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  expired: { label: 'Expired', variant: 'danger' },
  inactive: { label: 'Inactive', variant: 'neutral' },
};

const TYPE_LABEL: Record<ReturnType<typeof couponDisplayType>, string> = {
  PERCENT: 'Percent',
  FIXED: 'Fixed',
  FREE_SHIPPING: 'Free shipping',
};

/**
 * Render the discount value column. Percentage stays as a "%"; fixed amounts
 * come back in major units (NOT cents) per the backend DTO, so we render via
 * `formatCurrencyCents` after a *100 to stay consistent with the rest of the
 * app's money formatting. Free shipping ignores the value.
 */
function renderValue(c: Coupon): string {
  const t = couponDisplayType(c);
  if (t === 'FREE_SHIPPING') return '—';
  if (t === 'PERCENT') return `${c.discountValue}%`;
  // backend `discountValue` for fixed coupons is documented as integer cents
  return formatCurrencyCents(c.discountValue, c.currency);
}

function renderRedemptions(c: Coupon): string {
  if (c.usageLimit) return `${c.redemptionsCount} / ${c.usageLimit}`;
  return `${c.redemptionsCount} / ∞`;
}

export default function MarketingPage() {
  const [tab, setTab] = useState<CouponStatusFilter>('active');
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Coupon | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = useListCouponsQuery({ page: 1, limit: 100, status: tab });
  const [deleteCoupon] = useDeleteCouponMutation();
  const [deactivateCoupon] = useDeactivateCouponMutation();

  // Wrap in useMemo so the `?? []` fallback doesn't produce a fresh array on
  // every render (which would re-fire the downstream `useMemo`s).
  const allCoupons = useMemo(() => result?.data ?? [], [result?.data]);

  // The server-side filter only narrows by `isActive`. Apply the date
  // predicate + free-text search client-side so the tab counts agree with
  // what the user sees in the table.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCoupons.filter((c) => {
      const status = couponStatus(c);
      if (tab === 'active' && status !== 'active') return false;
      if (tab === 'scheduled' && status !== 'scheduled') return false;
      if (tab === 'expired' && status !== 'expired') return false;
      if (q && !c.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allCoupons, tab, search]);

  const counts = useMemo(() => {
    const c = { active: 0, scheduled: 0, expired: 0, all: allCoupons.length };
    for (const x of allCoupons) {
      const s = couponStatus(x);
      if (s === 'active') c.active += 1;
      else if (s === 'scheduled') c.scheduled += 1;
      else if (s === 'expired') c.expired += 1;
    }
    return c;
  }, [allCoupons]);

  const handleDelete = async (c: Coupon) => {
    if (c.redemptionsCount > 0) {
      const ok = window.confirm(
        `"${c.code}" has been redeemed ${c.redemptionsCount} time(s) and cannot be deleted. Deactivate it instead?`,
      );
      if (!ok) return;
      try {
        await deactivateCoupon(c.id).unwrap();
        toast.success(`"${c.code}" deactivated`);
      } catch {
        // toast surfaced by error middleware
      }
      return;
    }
    const ok = window.confirm(`Delete coupon "${c.code}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteCoupon(c.id).unwrap();
      toast.success(`"${c.code}" deleted`);
    } catch {
      // toast surfaced by error middleware
    }
  };

  const handleDeactivate = async (c: Coupon) => {
    if (!c.isActive) {
      toast.info(`"${c.code}" is already inactive`);
      return;
    }
    try {
      await deactivateCoupon(c.id).unwrap();
      toast.success(`"${c.code}" deactivated`);
    } catch {
      // toast surfaced by error middleware
    }
  };

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <div>
          <div className="font-mono text-xs font-medium text-stone-900">{c.code}</div>
          {c.description ? (
            <div className="text-xs text-stone-500 truncate max-w-[220px]">{c.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (c) => (
        <span className="text-sm text-stone-700">{TYPE_LABEL[couponDisplayType(c)]}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (c) => <span className="tabular-nums text-stone-900">{renderValue(c)}</span>,
    },
    {
      key: 'redemptions',
      header: 'Redemptions',
      render: (c) => (
        <span className="tabular-nums text-stone-700">{renderRedemptions(c)}</span>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (c) => <span className="text-xs text-stone-500">{formatDateShort(c.expiresAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        const s = couponStatus(c);
        return <Badge variant={STATUS_BADGE[s].variant}>{STATUS_BADGE[s].label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => setEditTarget(c)} aria-label={`Edit ${c.code}`}>
            <Edit2 className="w-3 h-3" /> Edit
          </Button>
          <Button size="sm" onClick={() => handleDeactivate(c)} aria-label={`Deactivate ${c.code}`}>
            <PowerOff className="w-3 h-3" /> Deactivate
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={() => handleDelete(c)}
            aria-label={`Delete ${c.code}`}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Discount codes and campaigns"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> New promotion
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md">
            {STATUS_TABS.map((opt) => (
              <button
                key={opt.v}
                onClick={() => setTab(opt.v)}
                className={clsx(
                  'px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5',
                  tab === opt.v
                    ? 'bg-white text-stone-900 shadow-sm font-medium'
                    : 'text-stone-600 hover:text-stone-900',
                )}
              >
                {opt.label}
                <span className="text-stone-400">{counts[opt.v]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coupon code…"
              className="!pl-9"
            />
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={
              allCoupons.length === 0
                ? 'No promotions yet'
                : `No ${tab === 'all' ? '' : tab} promotions`
            }
            description={
              allCoupons.length === 0
                ? 'Create a discount code to drive sales.'
                : search
                  ? 'Try a different search term or switch tabs.'
                  : 'Switch tabs to see codes in another state.'
            }
            action={
              allCoupons.length === 0 ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus className="w-3.5 h-3.5" /> New promotion
                </Button>
              ) : null
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            onRowClick={(c) => setEditTarget(c)}
          />
        )}
      </Card>

      <CouponModal open={creating} onClose={() => setCreating(false)} />
      <CouponModal
        open={!!editTarget}
        onClose={() => setEditTarget(undefined)}
        coupon={editTarget}
      />
    </>
  );
}
