/**
 * Coupons RTK Query slice (E3).
 *
 * Endpoints (backend `admin/coupons.controller.ts`):
 *   GET    /admin/coupons           → list (PaginatedResponseDto<Coupon>)
 *   POST   /admin/coupons           → create
 *   PATCH  /admin/coupons/:id       → update (only before any redemptions)
 *   DELETE /admin/coupons/:id       → soft-delete (only before any redemptions)
 *   PATCH  /admin/coupons/:id/deactivate → set isActive = false
 *
 * The frontend form schema (`lib/schemas/coupon.ts`) uses a richer vocabulary
 * than the wire DTO; the `toCreateDto` / `toUpdateDto` helpers here translate
 * `CouponFormValues` → the backend `CreateCouponDto` shape.
 *
 * Status taxonomy used by the list filter is derived client-side because the
 * backend only exposes `isActive`:
 *   active    → isActive && (!expiresAt || expiresAt > now) && (!startsAt || startsAt <= now)
 *   scheduled → isActive && startsAt && startsAt > now
 *   expired   → expiresAt && expiresAt <= now
 *   all       → no filtering
 *
 * We send `isActive` to the backend for `active|scheduled` (server narrows the
 * candidate set) and post-filter client-side for the date predicate.
 */
import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';
import type { CouponFormValues } from '@/lib/schemas/coupon';

// --- domain types ----------------------------------------------------------

export type CouponDiscountType = 'percentage' | 'fixed';
export type CouponStatusFilter = 'active' | 'expired' | 'scheduled' | 'all';

/**
 * Raw shape returned by the backend (`Coupon` schema). MongoDB exposes the
 * id as `_id`; we keep both `_id` and an alias `id` on the frontend type so
 * components can rely on a stable string key.
 */
export interface Coupon {
  _id: string;
  id: string;
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minPurchaseAmount?: number;
  currency: string;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  redemptionsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponsPageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListCouponsResult {
  data: Coupon[];
  meta: CouponsPageMeta;
}

export interface ListCouponsParams {
  page?: number;
  limit?: number;
  status?: CouponStatusFilter;
}

const EMPTY_META: CouponsPageMeta = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

// --- form ↔ DTO translation ------------------------------------------------

/**
 * Map our `CouponType` (PERCENT | FIXED | FREE_SHIPPING) to the backend's
 * narrower `discountType` enum. `FREE_SHIPPING` is not natively supported
 * by the backend yet; we encode it as a `fixed` discount with value 0 and
 * tag the description so the storefront can identify it. Tracked as a
 * follow-up backend change.
 */
interface BackendCreateCouponDto {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minPurchaseAmount?: number;
  startsAt?: string;
  expiresAt?: string;
  usageLimit?: number;
  usageLimitPerUser?: number;
  isActive?: boolean;
}

const FREE_SHIPPING_TAG = '[FREE_SHIPPING]';

export function toCreateDto(form: CouponFormValues): BackendCreateCouponDto {
  const isFreeShipping = form.type === 'FREE_SHIPPING';
  return {
    code: form.code,
    description: isFreeShipping ? FREE_SHIPPING_TAG : undefined,
    discountType: form.type === 'PERCENT' ? 'percentage' : 'fixed',
    discountValue: isFreeShipping ? 0 : Number(form.value),
    minPurchaseAmount: form.minSubtotalCents,
    startsAt: form.startsAt,
    expiresAt: form.expiresAt,
    usageLimit: form.maxRedemptions,
    usageLimitPerUser: form.perUserLimit,
    isActive: form.isActive,
  };
}

/**
 * Derive the form-side `CouponType` from a backend coupon. Falls back to
 * `FIXED`/`PERCENT` if the description does not carry the free-shipping tag.
 */
export function couponDisplayType(c: Coupon): 'PERCENT' | 'FIXED' | 'FREE_SHIPPING' {
  if (c.description?.includes(FREE_SHIPPING_TAG)) return 'FREE_SHIPPING';
  return c.discountType === 'percentage' ? 'PERCENT' : 'FIXED';
}

/**
 * Inverse of `toCreateDto` for the edit modal. Returns the form input shape
 * (RHF defaults) — fields the backend leaves undefined are returned as
 * `undefined` rather than `''` so the optional `z.coerce.number()` validators
 * don't trip on an empty string at first render.
 */
export function toFormDefaults(c: Coupon): CouponFormValues {
  return {
    code: c.code,
    type: couponDisplayType(c),
    value: c.discountValue,
    minSubtotalCents: c.minPurchaseAmount,
    maxRedemptions: c.usageLimit,
    perUserLimit: c.usageLimitPerUser,
    startsAt: c.startsAt,
    expiresAt: c.expiresAt,
    isActive: c.isActive,
  };
}

// --- list-side status helpers ---------------------------------------------

/**
 * Compute the user-facing status for a single coupon. Centralised here so the
 * table badge, the tab filter, and the delete-confirm logic all agree.
 */
export function couponStatus(c: Coupon, now = Date.now()): 'active' | 'scheduled' | 'expired' | 'inactive' {
  const starts = c.startsAt ? new Date(c.startsAt).getTime() : undefined;
  const ends = c.expiresAt ? new Date(c.expiresAt).getTime() : undefined;
  if (ends !== undefined && ends <= now) return 'expired';
  if (!c.isActive) return 'inactive';
  if (starts !== undefined && starts > now) return 'scheduled';
  return 'active';
}

// --- raw backend shapes (for envelope unwrap) ------------------------------

interface BackendCouponRaw extends Omit<Coupon, 'id' | 'startsAt' | 'expiresAt' | 'createdAt' | 'updatedAt'> {
  startsAt?: string | Date;
  expiresAt?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface BackendListPayload {
  data: BackendCouponRaw[];
  meta: CouponsPageMeta;
}

function toIso(d: string | Date | undefined): string | undefined {
  if (d === undefined) return undefined;
  return typeof d === 'string' ? d : d.toISOString();
}

function normalizeCoupon(raw: BackendCouponRaw): Coupon {
  return {
    ...raw,
    _id: raw._id,
    id: raw._id,
    startsAt: toIso(raw.startsAt),
    expiresAt: toIso(raw.expiresAt),
    createdAt: toIso(raw.createdAt) ?? '',
    updatedAt: toIso(raw.updatedAt) ?? '',
  };
}

// --- slice -----------------------------------------------------------------

export const couponsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listCoupons: builder.query<ListCouponsResult, ListCouponsParams | void>({
      query: (params) => {
        const p = params || {};
        // The backend filter only understands `isActive`. For `active` and
        // `scheduled` we pre-narrow with isActive=true; for `expired` we
        // don't filter and rely on post-processing (an expired coupon may
        // still have isActive=true if it hasn't been deactivated).
        const isActive =
          p.status === 'active' || p.status === 'scheduled' ? true : undefined;
        return {
          url: '/admin/coupons',
          method: 'GET',
          params: {
            page: p.page,
            limit: p.limit,
            isActive,
          },
        };
      },
      transformResponse: (
        res: ResponseEnvelope<BackendListPayload> | BackendListPayload,
      ): ListCouponsResult => {
        const unwrapped = unwrapEnvelope<BackendListPayload>(
          res as ResponseEnvelope<BackendListPayload> | BackendListPayload,
        );
        if (!unwrapped || !Array.isArray(unwrapped.data)) {
          return { data: [], meta: { ...EMPTY_META } };
        }
        return {
          data: unwrapped.data.map(normalizeCoupon),
          meta: unwrapped.meta ?? { ...EMPTY_META },
        };
      },
      providesTags: (result) =>
        result
          ? [
              { type: 'Coupon', id: 'LIST' },
              ...result.data.map((c) => ({ type: 'Coupon' as const, id: c.id })),
            ]
          : [{ type: 'Coupon', id: 'LIST' }],
    }),

    getCoupon: builder.query<Coupon, string>({
      query: (id) => ({
        url: `/admin/coupons/${id}`,
        method: 'GET',
      }),
      transformResponse: (res: ResponseEnvelope<BackendCouponRaw> | BackendCouponRaw) =>
        normalizeCoupon(unwrapEnvelope<BackendCouponRaw>(res)),
      providesTags: (_, __, id) => [{ type: 'Coupon', id }],
    }),

    createCoupon: builder.mutation<Coupon, CouponFormValues>({
      query: (form) => ({
        url: '/admin/coupons',
        method: 'POST',
        body: toCreateDto(form),
      }),
      transformResponse: (res: ResponseEnvelope<BackendCouponRaw> | BackendCouponRaw) =>
        normalizeCoupon(unwrapEnvelope<BackendCouponRaw>(res)),
      invalidatesTags: [{ type: 'Coupon', id: 'LIST' }],
    }),

    updateCoupon: builder.mutation<Coupon, { id: string; patch: CouponFormValues }>({
      query: ({ id, patch }) => ({
        url: `/admin/coupons/${id}`,
        method: 'PATCH',
        body: toCreateDto(patch),
      }),
      transformResponse: (res: ResponseEnvelope<BackendCouponRaw> | BackendCouponRaw) =>
        normalizeCoupon(unwrapEnvelope<BackendCouponRaw>(res)),
      invalidatesTags: (_, __, { id }) => [
        { type: 'Coupon', id },
        { type: 'Coupon', id: 'LIST' },
      ],
    }),

    deleteCoupon: builder.mutation<{ success: true; id: string }, string>({
      query: (id) => ({
        url: `/admin/coupons/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (
        res: ResponseEnvelope<{ success: true; id: string }> | { success: true; id: string },
      ) => unwrapEnvelope(res),
      invalidatesTags: (_, __, id) => [
        { type: 'Coupon', id },
        { type: 'Coupon', id: 'LIST' },
      ],
    }),

    deactivateCoupon: builder.mutation<Coupon, string>({
      query: (id) => ({
        url: `/admin/coupons/${id}/deactivate`,
        method: 'PATCH',
      }),
      transformResponse: (res: ResponseEnvelope<BackendCouponRaw> | BackendCouponRaw) =>
        normalizeCoupon(unwrapEnvelope<BackendCouponRaw>(res)),
      invalidatesTags: (_, __, id) => [
        { type: 'Coupon', id },
        { type: 'Coupon', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListCouponsQuery,
  useGetCouponQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
  useDeactivateCouponMutation,
} = couponsApi;
