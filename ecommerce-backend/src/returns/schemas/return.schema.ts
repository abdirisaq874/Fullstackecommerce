import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReturnRequestDocument = HydratedDocument<ReturnRequest>;

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'received',
  'inspected',
  'refunded',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const REFUND_TYPES = ['full', 'partial', 'store_credit'] as const;
export type RefundType = (typeof REFUND_TYPES)[number];

// ─── Embedded: requested item line ───
@Schema({ _id: false })
export class ReturnItem {
  @Prop({ required: true }) sku: string;
  @Prop({ required: true, type: Number }) qty: number;
  @Prop({ required: true }) reason: string;
}
export const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

// ─── Embedded: status history entry ───
@Schema({ _id: false })
export class ReturnStatusHistoryEntry {
  @Prop({ required: true, enum: RETURN_STATUSES })
  status: ReturnStatus;

  @Prop({ required: true, type: Date, default: () => new Date() })
  at: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  byUserId?: Types.ObjectId;

  @Prop()
  notes?: string;
}
export const ReturnStatusHistoryEntrySchema = SchemaFactory.createForClass(
  ReturnStatusHistoryEntry,
);

// ─── Embedded: refund decision (set at inspection) ───
@Schema({ _id: false })
export class RefundDecision {
  @Prop({ enum: REFUND_TYPES })
  type?: RefundType;

  /** Refund amount in integer cents. */
  @Prop({ type: Number })
  refundAmountCents?: number;

  @Prop({ default: true })
  restockable: boolean;

  @Prop()
  inspectionNotes?: string;
}
export const RefundDecisionSchema = SchemaFactory.createForClass(RefundDecision);

// ─── Main ReturnRequest ───
@Schema({ timestamps: true, collection: 'return_requests' })
export class ReturnRequest {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ type: [ReturnItemSchema], default: [] })
  items: ReturnItem[];

  @Prop({
    enum: RETURN_STATUSES,
    default: 'requested',
    index: true,
    required: true,
  })
  status: ReturnStatus;

  @Prop({ type: [ReturnStatusHistoryEntrySchema], default: [] })
  statusHistory: ReturnStatusHistoryEntry[];

  @Prop({ type: RefundDecisionSchema, default: () => ({ restockable: true }) })
  refundDecision: RefundDecision;

  @Prop()
  returnLabelUrl?: string;
}

export const ReturnRequestSchema = SchemaFactory.createForClass(ReturnRequest);

// Compound indexes for the common seller / customer scopes.
ReturnRequestSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
ReturnRequestSchema.index({ userId: 1, createdAt: -1 });
ReturnRequestSchema.index({ orderId: 1, createdAt: -1 });
