/**
 * Message reply form schema — used by the thread detail page (D4) to validate
 * the reply composer before calling `useReplyToThreadMutation`.
 *
 * The shape mirrors `ReplyThreadBody` in `lib/api/messages-api.ts` minus the
 * `id` (which comes from the route), so the inferred type can be passed to the
 * mutation alongside the thread id.
 */
import { z } from 'zod';

export const replySchema = z.object({
  body: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message must be 5000 characters or fewer'),
  attachments: z
    .array(
      z.object({
        url: z.string().url('Attachment URL must be a valid URL'),
        name: z.string(),
        contentType: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .optional(),
});

export type ReplyFormValues = z.infer<typeof replySchema>;
