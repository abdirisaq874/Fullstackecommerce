/**
 * Shared create/edit dialog for coupons (E3).
 *
 * The modal is driven by react-hook-form + zod (`couponSchema`). It is used in
 * two modes:
 *   - `mode='create'` — POST /admin/coupons via `useCreateCouponMutation`
 *   - `mode='edit'`   — PATCH /admin/coupons/:id via `useUpdateCouponMutation`
 *                       Pre-fills defaults from the supplied `coupon` prop.
 *
 * The form value model (PERCENT/FIXED/FREE_SHIPPING, minSubtotalCents, …) is
 * translated to the backend's narrower DTO inside `coupons-api.ts` so this
 * component never has to know about wire shape.
 *
 * Validation:
 *   - `couponSchema` enforces code regex/length, percent ≤ 100, dates
 *     non-overlapping. Server-side conflicts (duplicate code, "has redemptions
 *     so cannot edit") surface as a toast via `error-middleware`.
 *
 * Date inputs:
 *   - `<input type="datetime-local">` gives us `YYYY-MM-DDTHH:mm` with no
 *     timezone. We convert to a full ISO string on submit because the schema
 *     uses `z.string().datetime()`. Empty strings collapse to `undefined`.
 */
'use client';

import { useEffect } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/primitives/modal';
import { Button } from '@/components/primitives/button';
import { Field, Input, Select } from '@/components/primitives/field';
import {
  useCreateCouponMutation,
  useUpdateCouponMutation,
  toFormDefaults,
  type Coupon,
} from '@/lib/api/coupons-api';
import {
  couponSchema,
  type CouponFormInput,
  type CouponFormValues,
  type CouponType,
} from '@/lib/schemas/coupon';

interface CouponModalProps {
  open: boolean;
  onClose: () => void;
  /** Existing coupon to edit. When `undefined`, the modal is in create mode. */
  coupon?: Coupon;
}

const TYPE_OPTIONS: { value: CouponType; label: string }[] = [
  { value: 'PERCENT', label: 'Percent off' },
  { value: 'FIXED', label: 'Fixed amount off' },
  { value: 'FREE_SHIPPING', label: 'Free shipping' },
];

/**
 * Convert a `datetime-local` value (e.g. "2026-06-15T09:30") into the ISO
 * string the zod schema expects. Empty input → `undefined`.
 */
function toIsoOrUndef(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * The reverse of `toIsoOrUndef`: take an ISO string and produce the
 * `datetime-local` representation (drop seconds + Z). Returns `''` for
 * undefined.
 */
function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // YYYY-MM-DDTHH:mm in the user's local time
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_DEFAULTS: CouponFormInput = {
  code: '',
  type: 'PERCENT',
  value: 10 as unknown as number, // CouponFormInput.value is `unknown` after coerce; cast for the literal
  minSubtotalCents: undefined,
  maxRedemptions: undefined,
  perUserLimit: undefined,
  startsAt: undefined,
  expiresAt: undefined,
  isActive: true,
};

export function CouponModal({ open, onClose, coupon }: CouponModalProps) {
  const mode: 'create' | 'edit' = coupon ? 'edit' : 'create';
  const [createCoupon, { isLoading: creating }] = useCreateCouponMutation();
  const [updateCoupon, { isLoading: updating }] = useUpdateCouponMutation();
  const submitting = creating || updating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CouponFormInput, unknown, CouponFormValues>({
    resolver: zodResolver(couponSchema),
    mode: 'onBlur',
    defaultValues: EMPTY_DEFAULTS,
  });

  // Re-seed the form whenever the modal opens or the target coupon changes —
  // RHF holds onto the previous values otherwise (e.g. opening the modal in
  // create mode immediately after editing would show the edited row's data).
  useEffect(() => {
    if (!open) return;
    if (coupon) {
      const defaults = toFormDefaults(coupon);
      reset({
        ...defaults,
        startsAt: defaults.startsAt,
        expiresAt: defaults.expiresAt,
      } as CouponFormInput);
    } else {
      reset(EMPTY_DEFAULTS);
    }
  }, [open, coupon, reset]);

  const type = watch('type');
  const valueHint =
    type === 'PERCENT'
      ? 'Percent (0–100)'
      : type === 'FIXED'
        ? 'Amount in major currency units (e.g. 5 = $5)'
        : 'Free shipping — value ignored';

  const onSubmit: SubmitHandler<CouponFormValues> = async (values) => {
    try {
      if (mode === 'edit' && coupon) {
        await updateCoupon({ id: coupon.id, patch: values }).unwrap();
        toast.success(`Coupon "${values.code}" updated`);
      } else {
        await createCoupon(values).unwrap();
        toast.success(`Coupon "${values.code}" created`);
      }
      onClose();
    } catch {
      // The global RTK-Query error middleware already surfaces the server
      // message as a toast; we just need to keep the modal open so the user
      // can correct the field.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit promotion' : 'New promotion'}
      subtitle={
        mode === 'edit'
          ? 'Only fields below can be changed; redeemed coupons must be deactivated instead.'
          : 'Create a discount code customers can apply at checkout.'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Code"
              required
              hint="Shown to customers at checkout"
              error={errors.code?.message}
            >
              <Input
                {...register('code')}
                placeholder="SUMMER25"
                autoCapitalize="characters"
                disabled={mode === 'edit' && (coupon?.redemptionsCount ?? 0) > 0}
              />
            </Field>
            <Field label="Type" required error={errors.type?.message}>
              <Select {...register('type')}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Value"
              required
              hint={valueHint}
              error={errors.value?.message}
            >
              <Input
                type="number"
                step="0.01"
                min={0}
                disabled={type === 'FREE_SHIPPING'}
                {...register('value')}
              />
            </Field>
            <Field
              label="Minimum subtotal (cents)"
              hint="Optional — coupon only applies when subtotal ≥ this"
              error={errors.minSubtotalCents?.message}
            >
              <Input type="number" min={0} {...register('minSubtotalCents')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Max redemptions"
              hint="Total times this code can be used"
              error={errors.maxRedemptions?.message}
            >
              <Input type="number" min={1} {...register('maxRedemptions')} />
            </Field>
            <Field
              label="Per-user limit"
              hint="Max times one user can redeem"
              error={errors.perUserLimit?.message}
            >
              <Input type="number" min={1} {...register('perUserLimit')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Starts at" error={errors.startsAt?.message}>
              <Controller
                control={control}
                name="startsAt"
                render={({ field }) => (
                  <Input
                    type="datetime-local"
                    value={toLocalInputValue(field.value)}
                    onChange={(e) => field.onChange(toIsoOrUndef(e.target.value))}
                  />
                )}
              />
            </Field>
            <Field label="Expires at" error={errors.expiresAt?.message}>
              <Controller
                control={control}
                name="expiresAt"
                render={({ field }) => (
                  <Input
                    type="datetime-local"
                    value={toLocalInputValue(field.value)}
                    onChange={(e) => field.onChange(toIsoOrUndef(e.target.value))}
                  />
                )}
              />
            </Field>
          </div>

          <Field label="Active">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                {...register('isActive')}
                className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
              />
              <span>Available to customers</span>
            </label>
          </Field>
        </div>

        <div className="px-6 py-4 bg-stone-50/60 border-t border-stone-200 flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? mode === 'edit'
                ? 'Saving…'
                : 'Creating…'
              : mode === 'edit'
                ? 'Save changes'
                : 'Create promotion'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
