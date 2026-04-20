// ─── payments/schemas/payment.schema.ts ───
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Order', index: true }) orderId: Types.ObjectId;
  @Prop({ enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer'] }) method: string;
  @Prop({ default: 'stripe' }) provider: string;
  @Prop() providerTxId: string;
  @Prop({ unique: true }) idempotencyKey: string;
  @Prop({ required: true, type: Number }) amount: number;
  @Prop({ default: 'USD' }) currency: string;
  @Prop({
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending',
  })
  status: string;
  @Prop() failureReason?: string;
  @Prop() paidAt?: Date;
}
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ providerTxId: 1 });

export default { Payment, PaymentSchema };
