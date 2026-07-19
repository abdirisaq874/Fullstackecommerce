import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmailLogStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed';

export type EmailFailureKind = 'bounce' | 'complaint' | 'provider-rejection' | 'timeout';

@Schema({ collection: 'email_logs', timestamps: true })
export class EmailLog {
  @Prop({ required: true }) template: string;
  @Prop({ required: true }) recipientAddress: string;
  @Prop() recipientUserId?: string;
  @Prop() subject?: string;
  @Prop({ required: true, default: 'queued' }) status: EmailLogStatus;

  @Prop() providerName?: string;
  @Prop() providerMessageId?: string;

  // Dedup pair (see MailService). Concurrency is prevented upstream by the
  // outbox unique index + BullMQ jobId, so this drives the final skip check.
  @Prop() triggeredByEventType?: string;
  @Prop() triggeredByAggregateId?: string;

  @Prop() correlationId?: string;
  @Prop() locale?: string;

  @Prop() queuedAt?: Date;
  @Prop() sentAt?: Date;
  @Prop() deliveredAt?: Date;
  @Prop() failedAt?: Date;
  @Prop() failureReason?: string;
  @Prop() failureKind?: EmailFailureKind;
}

export type EmailLogDocument = HydratedDocument<EmailLog>;
export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);

// Idempotency lookup (skip if an active send for this trigger+template exists).
EmailLogSchema.index({ triggeredByEventType: 1, triggeredByAggregateId: 1, template: 1, status: 1 });
// Webhook lookup by provider id.
EmailLogSchema.index({ providerMessageId: 1 }, { sparse: true });
