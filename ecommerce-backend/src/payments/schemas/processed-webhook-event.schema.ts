// ─── payments/schemas/processed-webhook-event.schema.ts ───
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProcessedWebhookEventDocument = HydratedDocument<ProcessedWebhookEvent>;

/**
 * Idempotency ledger for inbound webhooks. The unique index on `eventId` is the
 * dedup gate: inserting a row "claims" an event, and a duplicate-key error means
 * the event was already processed (or is being processed) — so it is skipped.
 */
@Schema({ timestamps: true, collection: 'processed_webhook_events' })
export class ProcessedWebhookEvent {
  @Prop({ required: true, unique: true }) eventId: string;
  @Prop() type: string;
  @Prop({ default: 'stripe' }) provider: string;
}

export const ProcessedWebhookEventSchema =
  SchemaFactory.createForClass(ProcessedWebhookEvent);
