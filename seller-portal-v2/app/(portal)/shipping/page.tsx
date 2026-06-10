'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus, Truck, Globe, Pencil, Trash2, ChevronRight, Search, Check,
} from 'lucide-react';
import clsx from 'clsx';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Modal } from '@/components/primitives/modal';
import { Field, Input } from '@/components/primitives/field';
import { DataTable, type Column } from '@/components/data/data-table';
import { TableSkeleton, EmptyState, ErrorState, CardSkeleton } from '@/components/data/states';
import {
  useListZonesQuery,
  useCreateZoneMutation,
  useUpdateZoneMutation,
  useDeleteZoneMutation,
  useListRatesForZoneQuery,
  useCreateRateMutation,
  useUpdateRateMutation,
  useDeleteRateMutation,
  type ShippingZone,
  type ShippingRate,
} from '@/lib/api';
import {
  zoneSchema,
  rateSchema,
  type ZoneFormInput,
  type ZoneFormValues,
  type RateFormInput,
  type RateFormValues,
} from '@/lib/schemas/shipping';
import { COUNTRIES, findCountry } from '@/lib/config/countries';

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default function ShippingPage() {
  const { data: zones = [], isLoading, isError, refetch } = useListZonesQuery();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [zoneModal, setZoneModal] = useState<{ mode: 'create' } | { mode: 'edit'; zone: ShippingZone } | null>(null);
  const [rateModal, setRateModal] = useState<{ mode: 'create' } | { mode: 'edit'; rate: ShippingRate } | null>(null);

  // Auto-select first zone once data loads, if nothing is selected yet.
  useEffect(() => {
    if (!selectedZoneId && zones.length > 0) {
      setSelectedZoneId(zones[0]._id);
    }
    // If the selected zone is deleted out from under us, clear selection.
    if (selectedZoneId && !zones.some((z) => z._id === selectedZoneId)) {
      setSelectedZoneId(zones[0]?._id ?? null);
    }
  }, [zones, selectedZoneId]);

  const selectedZone = useMemo(
    () => zones.find((z) => z._id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <>
      <PageHeader
        title="Shipping"
        subtitle="Zones, lead times, and rate cards"
        actions={
          <Button variant="primary" onClick={() => setZoneModal({ mode: 'create' })}>
            <Plus className="w-3.5 h-3.5" /> Add zone
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: zones */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Zones</CardTitle>
              <Badge>{zones.length}</Badge>
            </CardHeader>
            {isLoading ? (
              <div className="p-4 space-y-3">
                <CardSkeleton height={56} />
                <CardSkeleton height={56} />
                <CardSkeleton height={56} />
              </div>
            ) : zones.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="No shipping zones"
                description="Create your first zone to define where you deliver and how long it takes."
                action={
                  <Button variant="primary" onClick={() => setZoneModal({ mode: 'create' })}>
                    <Plus className="w-3.5 h-3.5" /> Add zone
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {zones.map((zone) => {
                  const isSelected = zone._id === selectedZoneId;
                  return (
                    <li key={zone._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedZoneId(zone._id)}
                        className={clsx(
                          'w-full text-left px-5 py-3.5 flex items-center gap-3 transition-colors',
                          isSelected ? 'bg-brand-50/40' : 'hover:bg-stone-50/50',
                        )}
                      >
                        <div className={clsx(
                          'w-8 h-8 rounded-md grid place-items-center shrink-0',
                          isSelected ? 'bg-brand-100 text-brand-800' : 'bg-stone-100 text-stone-500',
                        )}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-stone-900 truncate">{zone.name}</span>
                            {!zone.active && <Badge variant="neutral">Paused</Badge>}
                          </div>
                          <div className="text-xs text-stone-500 truncate mt-0.5">
                            {zone.countries.length} {zone.countries.length === 1 ? 'country' : 'countries'} · {zone.leadTimeDays}d lead time
                          </div>
                        </div>
                        <ChevronRight className={clsx('w-4 h-4 shrink-0', isSelected ? 'text-brand-700' : 'text-stone-300')} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right: zone detail + rates */}
        <div className="lg:col-span-2">
          {selectedZone ? (
            <ZoneDetail
              zone={selectedZone}
              onEditZone={() => setZoneModal({ mode: 'edit', zone: selectedZone })}
              onAddRate={() => setRateModal({ mode: 'create' })}
              onEditRate={(rate) => setRateModal({ mode: 'edit', rate })}
            />
          ) : (
            <Card>
              <EmptyState
                icon={Truck}
                title={isLoading ? 'Loading zones…' : 'Select a zone'}
                description={isLoading ? undefined : 'Choose a shipping zone on the left to view and edit its rate card.'}
              />
            </Card>
          )}
        </div>
      </div>

      {/* Zone modal */}
      {zoneModal && (
        <ZoneModal
          mode={zoneModal.mode}
          zone={zoneModal.mode === 'edit' ? zoneModal.zone : undefined}
          onClose={() => setZoneModal(null)}
          onCreated={(zone) => setSelectedZoneId(zone._id)}
        />
      )}

      {/* Rate modal */}
      {rateModal && selectedZone && (
        <RateModal
          mode={rateModal.mode}
          zoneId={selectedZone._id}
          rate={rateModal.mode === 'edit' ? rateModal.rate : undefined}
          onClose={() => setRateModal(null)}
        />
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Zone detail (rates table)
// ────────────────────────────────────────────────────────────

function ZoneDetail({
  zone, onEditZone, onAddRate, onEditRate,
}: {
  zone: ShippingZone;
  onEditZone: () => void;
  onAddRate: () => void;
  onEditRate: (rate: ShippingRate) => void;
}) {
  const { data: rates = [], isLoading, isError, refetch } = useListRatesForZoneQuery(zone._id);
  const [deleteZone, { isLoading: deletingZone }] = useDeleteZoneMutation();
  const [deleteRate, { isLoading: deletingRate }] = useDeleteRateMutation();

  const handleDeleteZone = async () => {
    if (!confirm(`Delete zone "${zone.name}"? Its rates will also be removed.`)) return;
    try {
      await deleteZone(zone._id).unwrap();
      toast.success(`Zone "${zone.name}" deleted`);
    } catch {
      toast.error('Failed to delete zone');
    }
  };

  const handleDeleteRate = async (rate: ShippingRate) => {
    if (!confirm(`Delete rate "${rate.method}"?`)) return;
    try {
      await deleteRate({ zoneId: zone._id, rateId: rate._id }).unwrap();
      toast.success(`Rate "${rate.method}" deleted`);
    } catch {
      toast.error('Failed to delete rate');
    }
  };

  const columns: Column<ShippingRate>[] = [
    {
      key: 'method', header: 'Method',
      render: (r) => (
        <div>
          <div className="text-sm font-medium text-stone-900 capitalize">{r.method}</div>
          {!r.active && <Badge variant="neutral" className="mt-0.5">Inactive</Badge>}
        </div>
      ),
    },
    {
      key: 'base', header: 'Base', className: 'text-right',
      render: (r) => <span className="tabular-nums text-sm text-stone-900">{formatCents(r.baseCostCents)}</span>,
    },
    {
      key: 'perItem', header: 'Per item', className: 'text-right',
      render: (r) => <span className="tabular-nums text-xs text-stone-500">{formatCents(r.perItemCostCents)}</span>,
    },
    {
      key: 'perKg', header: 'Per kg', className: 'text-right',
      render: (r) => <span className="tabular-nums text-xs text-stone-500">{formatCents(r.perKgCostCents)}</span>,
    },
    {
      key: 'delivery', header: 'Delivery', className: 'text-right',
      render: (r) => <span className="text-xs text-stone-600">{r.minDeliveryDays}–{r.maxDeliveryDays} days</span>,
    },
    {
      key: 'actions', header: '', className: 'text-right w-24',
      render: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => onEditRate(r)} aria-label="Edit rate">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={() => handleDeleteRate(r)}
            disabled={deletingRate}
            aria-label="Delete rate"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Zone summary */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-serif text-2xl text-stone-900 leading-tight">{zone.name}</h2>
              {zone.active
                ? <Badge variant="success">Active</Badge>
                : <Badge variant="neutral">Paused</Badge>}
            </div>
            <div className="text-sm text-stone-500">
              {zone.leadTimeDays}-day lead time · {zone.countries.length} {zone.countries.length === 1 ? 'country' : 'countries'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onEditZone}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="danger-ghost" onClick={handleDeleteZone} disabled={deletingZone}>
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {zone.countries.map((code) => {
            const c = findCountry(code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-stone-100 text-stone-700"
              >
                <span aria-hidden>{c?.flag ?? '🏳️'}</span>
                <span className="font-mono">{code}</span>
                {c && <span className="text-stone-500">· {c.name}</span>}
              </span>
            );
          })}
        </div>
      </Card>

      {/* Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Rate card</CardTitle>
            <Badge>{rates.length}</Badge>
          </div>
          <Button variant="primary" onClick={onAddRate}>
            <Plus className="w-3.5 h-3.5" /> Add rate
          </Button>
        </CardHeader>
        {isError ? (
          <ErrorState onRetry={refetch} message="Couldn't load rates for this zone." />
        ) : isLoading ? (
          <TableSkeleton rows={3} columns={6} />
        ) : rates.length === 0 ? (
          <EmptyState
            title="No rates yet"
            description="Add a shipping method (e.g. standard, express) with its costs and delivery window."
            action={
              <Button variant="primary" onClick={onAddRate}>
                <Plus className="w-3.5 h-3.5" /> Add rate
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={rates}
            rowKey={(r) => r._id}
          />
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Zone modal (create / edit)
// ────────────────────────────────────────────────────────────

function ZoneModal({
  mode, zone, onClose, onCreated,
}: {
  mode: 'create' | 'edit';
  zone?: ShippingZone;
  onClose: () => void;
  onCreated?: (zone: ShippingZone) => void;
}) {
  const [createZone, { isLoading: creating }] = useCreateZoneMutation();
  const [updateZone, { isLoading: updating }] = useUpdateZoneMutation();
  const saving = creating || updating;

  const {
    register, handleSubmit, control,
    formState: { errors },
  } = useForm<ZoneFormInput, unknown, ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: zone
      ? {
          name: zone.name,
          countries: [...zone.countries],
          active: zone.active,
          leadTimeDays: zone.leadTimeDays,
        }
      : {
          name: '',
          countries: [],
          active: true,
          leadTimeDays: 5,
        },
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<ZoneFormValues> = async (values) => {
    try {
      if (mode === 'create') {
        const created = await createZone(values).unwrap();
        toast.success(`Zone "${created.name}" created`);
        onCreated?.(created);
      } else if (zone) {
        const updated = await updateZone({ id: zone._id, patch: values }).unwrap();
        toast.success(`Zone "${updated.name}" updated`);
      }
      onClose();
    } catch {
      toast.error('Failed to save zone');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'Add shipping zone' : `Edit ${zone?.name ?? 'zone'}`}
      subtitle="Group destination countries by lead time and rate card."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4" noValidate>
        <Field label="Zone name" required error={errors.name?.message}>
          <Input
            placeholder="e.g. North America"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>

        <Field
          label="Lead time (days)"
          required
          hint="Average days between order and dispatch."
          error={errors.leadTimeDays?.message}
        >
          <Input
            type="number"
            min={1}
            aria-invalid={Boolean(errors.leadTimeDays)}
            {...register('leadTimeDays')}
          />
        </Field>

        <Field
          label="Countries"
          required
          hint="Select every destination this zone covers."
          error={
            Array.isArray(errors.countries)
              ? errors.countries.find((e) => e?.message)?.message
              : (errors.countries as { message?: string } | undefined)?.message
          }
        >
          <Controller
            control={control}
            name="countries"
            render={({ field }) => (
              <CountryMultiSelect
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </Field>

        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
              />
              <span className="text-sm text-stone-800">Zone active</span>
            </label>
          )}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {mode === 'create' ? 'Create zone' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
// Rate modal (create / edit)
// ────────────────────────────────────────────────────────────

function RateModal({
  mode, zoneId, rate, onClose,
}: {
  mode: 'create' | 'edit';
  zoneId: string;
  rate?: ShippingRate;
  onClose: () => void;
}) {
  const [createRate, { isLoading: creating }] = useCreateRateMutation();
  const [updateRate, { isLoading: updating }] = useUpdateRateMutation();
  const saving = creating || updating;

  const {
    register, handleSubmit, control,
    formState: { errors },
  } = useForm<RateFormInput, unknown, RateFormValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: rate
      ? {
          method: rate.method,
          baseCostCents: rate.baseCostCents,
          perItemCostCents: rate.perItemCostCents,
          perKgCostCents: rate.perKgCostCents,
          minDeliveryDays: rate.minDeliveryDays,
          maxDeliveryDays: rate.maxDeliveryDays,
          active: rate.active,
        }
      : {
          method: '',
          baseCostCents: 0,
          perItemCostCents: 0,
          perKgCostCents: 0,
          minDeliveryDays: 3,
          maxDeliveryDays: 7,
          active: true,
        },
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<RateFormValues> = async (values) => {
    try {
      if (mode === 'create') {
        const created = await createRate({ zoneId, body: values }).unwrap();
        toast.success(`Rate "${created.method}" added`);
      } else if (rate) {
        const updated = await updateRate({ zoneId, rateId: rate._id, patch: values }).unwrap();
        toast.success(`Rate "${updated.method}" updated`);
      }
      onClose();
    } catch {
      toast.error('Failed to save rate');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'Add shipping rate' : `Edit ${rate?.method ?? 'rate'}`}
      subtitle="Costs are stored as whole cents (1.00 = 100)."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4" noValidate>
        <Field label="Method" required hint="e.g. standard, express, overnight" error={errors.method?.message}>
          <Input
            placeholder="standard"
            aria-invalid={Boolean(errors.method)}
            {...register('method')}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Base cost (¢)" required error={errors.baseCostCents?.message}>
            <Input
              type="number"
              min={0}
              aria-invalid={Boolean(errors.baseCostCents)}
              {...register('baseCostCents')}
            />
          </Field>
          <Field label="Per item (¢)" error={errors.perItemCostCents?.message}>
            <Input
              type="number"
              min={0}
              aria-invalid={Boolean(errors.perItemCostCents)}
              {...register('perItemCostCents')}
            />
          </Field>
          <Field label="Per kg (¢)" error={errors.perKgCostCents?.message}>
            <Input
              type="number"
              min={0}
              aria-invalid={Boolean(errors.perKgCostCents)}
              {...register('perKgCostCents')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min delivery days" required error={errors.minDeliveryDays?.message}>
            <Input
              type="number"
              min={0}
              aria-invalid={Boolean(errors.minDeliveryDays)}
              {...register('minDeliveryDays')}
            />
          </Field>
          <Field label="Max delivery days" required error={errors.maxDeliveryDays?.message}>
            <Input
              type="number"
              min={1}
              aria-invalid={Boolean(errors.maxDeliveryDays)}
              {...register('maxDeliveryDays')}
            />
          </Field>
        </div>

        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
              />
              <span className="text-sm text-stone-800">Rate active</span>
            </label>
          )}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {mode === 'create' ? 'Create rate' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
// Country multi-select (searchable, checkboxes)
// ────────────────────────────────────────────────────────────

function CountryMultiSelect({
  value, onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(value.map((c) => c.toUpperCase())), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (code: string) => {
    const upper = code.toUpperCase();
    if (selectedSet.has(upper)) {
      onChange(value.filter((c) => c.toUpperCase() !== upper));
    } else {
      onChange([...value, upper]);
    }
  };

  return (
    <div className="border border-stone-200 rounded-md bg-white">
      {/* Search */}
      <div className="relative border-b border-stone-200">
        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          className="w-full pl-9 pr-3 py-2 text-sm outline-none rounded-t-md"
        />
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="px-3 py-2 border-b border-stone-200 flex flex-wrap gap-1.5">
          {value.map((code) => {
            const c = findCountry(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/20 hover:bg-brand-100"
              >
                <span aria-hidden>{c?.flag ?? '🏳️'}</span>
                <span className="font-mono">{code}</span>
                <span aria-hidden className="text-brand-700">×</span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      <ul className="max-h-60 overflow-y-auto scrollbar-thin py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-stone-500">No matches.</li>
        ) : (
          filtered.map((c) => {
            const checked = selectedSet.has(c.code);
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => toggle(c.code)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors',
                    checked ? 'bg-brand-50/40 text-stone-900' : 'hover:bg-stone-50 text-stone-700',
                  )}
                >
                  <span
                    className={clsx(
                      'w-4 h-4 rounded border grid place-items-center shrink-0',
                      checked ? 'bg-brand-700 border-brand-700 text-white' : 'border-stone-300 bg-white',
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  <span aria-hidden>{c.flag}</span>
                  <span className="font-mono text-xs text-stone-500 w-7">{c.code}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Format cents as a USD-style decimal — purely display, never sent to the API. */
function formatCents(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
}
