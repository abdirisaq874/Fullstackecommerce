/**
 * Inventory form schemas.
 *
 * Used by the inventory detail page (D2) to validate the manual stock
 * adjustment form before dispatching the `useAdjustInventoryMutation`
 * mutation. The schema describes the *form input* shape (what
 * react-hook-form binds to); the request body shape lives in
 * `lib/api/inventory-api.ts`.
 */
import { z } from 'zod';

/**
 * Manual inventory adjustment.
 *
 * `deltaQty` is coerced from the underlying `<input type="number">`
 * string value into an integer, and can be positive (stock received,
 * audit found extra) or negative (damage, write-off, transfer out).
 * Zero is allowed by the schema itself — the submit button is
 * separately disabled for zero adjustments so users get a clearer UX.
 */
export const adjustInventorySchema = z.object({
  reason: z.enum(['receive', 'damage', 'audit', 'correction', 'transfer']),
  deltaQty: z.coerce
    .number({ message: 'Enter a number' })
    .int('Quantity must be a whole number'),
  notes: z.string().max(500, 'Keep notes under 500 characters').optional(),
});

/**
 * Input type — what react-hook-form binds the form to.
 * `deltaQty` is `unknown` here because `z.coerce.number()` accepts any
 * input and coerces it; the underlying `<input type="number">` returns a
 * string. This matches how `lib/schemas/return.ts` handles the same case.
 */
export type AdjustInventoryFormInput = z.input<typeof adjustInventorySchema>;

/**
 * Output type — the validated, coerced values handed to the submit
 * handler by `handleSubmit`. `deltaQty` is a number here.
 */
export type AdjustInventoryFormValues = z.infer<typeof adjustInventorySchema>;
