/**
 * Coupon form schema (E3).
 *
 * The form vocabulary is intentionally richer than the current backend DTO
 * (`ecommerce-backend/src/coupons/dto/coupon.dto.ts`):
 *
 *   Form field            ↔ Backend field
 *   --------------------------------------------------------
 *   type: 'PERCENT'       → discountType: 'percentage'
 *   type: 'FIXED'         → discountType: 'fixed'
 *   type: 'FREE_SHIPPING' → discountType: 'fixed' (value forced to 0; UI surfaces
 *                           this as a free-shipping coupon and the checkout flow
 *                           reads the description tag — proper backend support
 *                           is tracked separately)
 *   value                 → discountValue
 *   minSubtotalCents      → minPurchaseAmount
 *   maxRedemptions        → usageLimit
 *   perUserLimit          → usageLimitPerUser
 *
 * The translation lives in `lib/api/coupons-api.ts` so the form stays agnostic
 * of the wire shape. RHF binds to `CouponFormInput` (pre-coerce); the submit
 * handler receives `CouponFormValues` (validated/coerced).
 */
import { z } from 'zod';

export const couponTypeSchema = z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']);
export type CouponType = z.infer<typeof couponTypeSchema>;

export const couponSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(50, 'Code must be at most 50 characters')
      .regex(/^[A-Z0-9_-]+$/i, 'Alphanumeric, dashes, underscores only')
      .transform((s) => s.toUpperCase()),
    type: couponTypeSchema,
    value: z.coerce.number().nonnegative('Value must be ≥ 0'),
    minSubtotalCents: z.coerce.number().int().nonnegative().optional(),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    perUserLimit: z.coerce.number().int().positive().optional(),
    startsAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== 'PERCENT' || d.value <= 100, {
    message: 'Percent must be ≤ 100',
    path: ['value'],
  })
  .refine(
    (d) => !d.startsAt || !d.expiresAt || new Date(d.startsAt) < new Date(d.expiresAt),
    { message: 'Expiration must be after start', path: ['expiresAt'] },
  );

export type CouponFormInput = z.input<typeof couponSchema>;
export type CouponFormValues = z.output<typeof couponSchema>;
