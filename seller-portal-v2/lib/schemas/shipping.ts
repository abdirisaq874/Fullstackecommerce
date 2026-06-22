/**
 * Shipping form schemas.
 *
 * Used by the shipping page (E4) to validate the zone- and rate-create/edit
 * modal forms before dispatching the corresponding shipping-api mutations.
 *
 * The schemas describe the *form input* shape (what react-hook-form binds
 * to). The request body shapes live in `lib/api/shipping-api.ts` and are
 * derived from / compatible with these schemas' inferred output type.
 *
 * Country codes are upper-case ISO-3166-1 alpha-2 (e.g. "US", "CA", "DE").
 * `z.coerce.number()` is used on every cents/days field because the
 * underlying `<input type="number">` returns a string.
 */
import { z } from 'zod';

export const zoneSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be 100 characters or fewer'),
  countries: z
    .array(z.string().length(2, 'Use a 2-letter ISO country code'))
    .min(1, 'At least one country'),
  active: z.boolean().default(true),
  leadTimeDays: z.coerce.number().int().positive('Lead time must be at least 1 day').default(5),
});

export type ZoneFormInput = z.input<typeof zoneSchema>;
export type ZoneFormValues = z.output<typeof zoneSchema>;

export const rateSchema = z
  .object({
    method: z.string().min(2, 'Method must be at least 2 characters'),
    baseCostCents: z.coerce.number().int().nonnegative('Cost cannot be negative'),
    perItemCostCents: z.coerce.number().int().nonnegative('Cost cannot be negative').default(0),
    perKgCostCents: z.coerce.number().int().nonnegative('Cost cannot be negative').default(0),
    minDeliveryDays: z.coerce.number().int().nonnegative('Days cannot be negative'),
    maxDeliveryDays: z.coerce.number().int().positive('Max days must be at least 1'),
    active: z.boolean().default(true),
  })
  .refine((d) => d.maxDeliveryDays >= d.minDeliveryDays, {
    message: 'Max days must be greater than or equal to min days',
    path: ['maxDeliveryDays'],
  });

export type RateFormInput = z.input<typeof rateSchema>;
export type RateFormValues = z.output<typeof rateSchema>;
