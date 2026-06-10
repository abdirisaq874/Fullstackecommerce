/**
 * Return / RMA form schemas.
 *
 * Used by the return detail page (D3) to validate the post-receipt
 * inspection form before dispatching `useRecordInspectionMutation`.
 * The schema describes the *form input* shape (what react-hook-form
 * binds to); the request body shape lives in `lib/api/returns-api.ts`
 * (see `RecordInspectionBody.refundDecision`).
 *
 * Notes:
 *   - `refundAmountCents` is coerced from the underlying
 *     `<input type="number">` string value into a non-negative integer.
 *     The UI collects whole cents (no fractional cents). When the
 *     refund type is "partial" the amount is required and must be
 *     strictly positive; otherwise it is optional (full refunds and
 *     store credit derive the amount server-side from the return).
 *   - The refund-type vocabulary intentionally matches the backend's
 *     `RecordInspectionDto.refundDecision.type` enum
 *     (`'full' | 'partial' | 'store_credit'`), not the legacy frontend
 *     `RefundDecision` union (`'full-refund' | 'partial-refund' | ...`).
 *     The page-level submit handler maps between the two.
 */
import { z } from 'zod';

export const inspectionSchema = z
  .object({
    refundType: z.enum(['full', 'partial', 'store_credit']),
    refundAmountCents: z.coerce.number().int().nonnegative().optional(),
    restockable: z.boolean(),
    inspectionNotes: z.string().max(1000).optional(),
  })
  .refine(
    (d) => d.refundType !== 'partial' || (d.refundAmountCents && d.refundAmountCents > 0),
    { message: 'Partial refund requires an amount', path: ['refundAmountCents'] },
  );

/**
 * `InspectionFormInput` is what react-hook-form binds to (pre-coerce,
 * pre-refine). `InspectionFormValues` is the validated output passed
 * to the submit handler after `zodResolver` has run.
 */
export type InspectionFormInput = z.input<typeof inspectionSchema>;
export type InspectionFormValues = z.output<typeof inspectionSchema>;
