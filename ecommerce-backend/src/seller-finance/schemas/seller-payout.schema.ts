import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SellerPayoutDocument = HydratedDocument<SellerPayout>;

export const PAYOUT_STATUSES = [
  'pending',
  'processing',
  'paid',
  'failed',
  'cancelled',
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

@Schema({ timestamps: true, collection: 'seller_payouts' })
export class SellerPayout {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  periodStart: Date;

  @Prop({ type: Date, required: true })
  periodEnd: Date;

  // Money stored as integer cents.
  @Prop({ type: Number, required: true })
  amountCents: number;

  @Prop({ type: Number, required: true, default: 0 })
  feeCents: number;

  // Computed = amountCents - feeCents. Persisted for fast reads, kept in sync
  // by service-layer writes and the pre-save hook below.
  @Prop({ type: Number, required: true })
  netCents: number;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  @Prop({
    type: String,
    enum: PAYOUT_STATUSES,
    default: 'pending',
    index: true,
  })
  status: PayoutStatus;

  // TODO(stripe-connect): populated when the payout is created in Stripe.
  @Prop({ type: String })
  stripePayoutId?: string;

  @Prop({ type: Date })
  paidAt?: Date;
}

export const SellerPayoutSchema = SchemaFactory.createForClass(SellerPayout);

// Keep netCents derived from amountCents - feeCents on every write.
SellerPayoutSchema.pre('save', function (next) {
  const doc = this as SellerPayoutDocument;
  doc.netCents = (doc.amountCents ?? 0) - (doc.feeCents ?? 0);
  next();
});

SellerPayoutSchema.index({ sellerId: 1, createdAt: -1 });
SellerPayoutSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
