/**
 * Seller settings form schemas (E1).
 *
 * Mirrors `ecommerce-backend/src/seller-settings/dto/seller-settings.dto.ts`.
 * Each settings sub-page (`/settings/<slug>`) consumes one section and
 * submits a partial PUT body containing just that section.
 *
 * Naming convention: the full document schema is `sellerSettingsSchema`;
 * each section also has a standalone schema export (`storeProfileSchema`,
 * `payoutsSchema`, etc.) so a sub-page can use it as the resolver schema
 * directly without `.pick()` gymnastics.
 */
import { z } from 'zod';

// --- enums ----------------------------------------------------------------

export const payoutMethodSchema = z.enum(['stripe', 'bank', 'paypal']);
export type PayoutMethod = z.infer<typeof payoutMethodSchema>;

export const payoutScheduleSchema = z.enum(['weekly', 'biweekly', 'monthly']);
export type PayoutSchedule = z.infer<typeof payoutScheduleSchema>;

// --- helpers --------------------------------------------------------------

const trimmedOptional = z.string().trim().optional().or(z.literal(''));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'Enter a valid email address',
  );

// --- store profile --------------------------------------------------------

export const storeProfileSchema = z.object({
  displayName: trimmedOptional,
  slug: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || /^[a-z0-9-]+$/.test(v),
      'Lowercase letters, numbers and hyphens only',
    ),
  logoUrl: trimmedOptional,
  country: trimmedOptional,
  currency: z.string().trim().min(1, 'Currency is required').default('USD'),
  supportEmail: optionalEmail,
  supportPhone: trimmedOptional,
});

export type StoreProfileFormValues = z.infer<typeof storeProfileSchema>;

// --- payouts --------------------------------------------------------------

export const payoutsSchema = z.object({
  stripeConnectAccountId: trimmedOptional,
  payoutMethod: payoutMethodSchema.optional(),
  bankAccountLast4: trimmedOptional,
  payoutSchedule: payoutScheduleSchema.default('weekly'),
});

export type PayoutsFormValues = z.infer<typeof payoutsSchema>;

// --- tax ------------------------------------------------------------------

export const taxSchema = z.object({
  taxId: trimmedOptional,
  taxExempt: z.boolean().default(false),
  /**
   * Form input is a percent string (e.g. "18" for 18 %). We coerce + validate
   * here; the page maps it to the backend's 0..1 fraction shape on submit.
   */
  defaultTaxRatePercent: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Number(v)), 'Must be a number')
    .refine(
      (v) => !v || (Number(v) >= 0 && Number(v) <= 100),
      'Must be between 0 and 100',
    ),
});

export type TaxFormValues = z.infer<typeof taxSchema>;

// --- shipping defaults ----------------------------------------------------

export const shippingDefaultsSchema = z.object({
  defaultZoneId: trimmedOptional,
  defaultHandlingDays: z
    .string()
    .trim()
    .min(1, 'Handling days is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Must be ≥ 0'),
});

export type ShippingDefaultsFormValues = z.infer<typeof shippingDefaultsSchema>;

// --- notifications --------------------------------------------------------

export const notificationsSchema = z.object({
  newOrderEmail: z.boolean().default(true),
  lowStockEmail: z.boolean().default(true),
  returnRequestEmail: z.boolean().default(true),
  messageEmail: z.boolean().default(true),
});

export type NotificationsFormValues = z.infer<typeof notificationsSchema>;

// --- unified schema (handy for downstream callers / docs) -----------------

export const sellerSettingsSchema = z.object({
  storeProfile: storeProfileSchema,
  payouts: payoutsSchema,
  tax: taxSchema,
  shippingDefaults: shippingDefaultsSchema,
  notifications: notificationsSchema,
  preferredLanguage: z.string().trim().default('en'),
});

export type SellerSettingsFormValues = z.infer<typeof sellerSettingsSchema>;
