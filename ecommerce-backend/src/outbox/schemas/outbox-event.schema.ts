import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OutboxEventStatus = 'pending' | 'processing' | 'published' | 'failed';

@Schema({ collection: 'outbox_events', timestamps: true })
export class OutboxEvent {
  @Prop({ required: true, index: true }) eventType: string;
  @Prop({ required: true }) aggregateType: string;
  @Prop({ required: true }) aggregateId: string;
  @Prop({ type: Object, default: {} }) payload: Record<string, unknown>;
  @Prop({ required: true }) occurredAt: Date;
  @Prop() correlationId?: string;

  /** Unique → duplicate publishes of the same event are swallowed (idempotent). */
  @Prop({ required: true, unique: true }) idempotencyKey: string;

  @Prop({ required: true, default: 'pending' }) status: OutboxEventStatus;
  @Prop({ default: 0 }) attemptCount: number;
  @Prop() lockedAt?: Date;
  @Prop() lastError?: string;
}

export type OutboxEventDocument = HydratedDocument<OutboxEvent>;
export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);
// Poller claim query: oldest pending first.
OutboxEventSchema.index({ status: 1, occurredAt: 1 });
