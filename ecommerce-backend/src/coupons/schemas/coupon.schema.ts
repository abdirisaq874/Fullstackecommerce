import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteMiddleware } from '../../shared/database/base.schema';

export type CouponDocument = HydratedDocument<Coupon>;

@Schema({ timestamps: true, collection: 'coupons' })
export class Coupon {
  @Prop({ required: true, unique: true, index: true, uppercase: true, trim: true })
  code: string;

  @Prop() description?: string;

  // 'percentage' = percent off (0-100); 'fixed' = fixed amount off in integer cents
  @Prop({ enum: ['percentage', 'fixed'], required: true })
  discountType: 'percentage' | 'fixed';

  @Prop({ required: true, type: Number, min: 0 })
  discountValue: number;

  // Optional cap on percentage discounts (integer cents).
  @Prop({ type: Number, min: 0 })
  maxDiscountAmount?: number;

  // Minimum order subtotal required (integer cents).
  @Prop({ type: Number, min: 0 })
  minPurchaseAmount?: number;

  @Prop({ default: 'USD' }) currency: string;

  @Prop() startsAt?: Date;
  @Prop() expiresAt?: Date;

  // Optional global redemption cap.
  @Prop({ type: Number, min: 0 })
  usageLimit?: number;

  // Optional per-user redemption cap.
  @Prop({ type: Number, min: 0 })
  usageLimitPerUser?: number;

  @Prop({ default: 0, min: 0 }) redemptionsCount: number;

  @Prop({ default: true, index: true }) isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ default: false }) isDeleted: boolean;
  @Prop() deletedAt?: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ isActive: 1, expiresAt: 1 });

applySoftDeleteMiddleware(CouponSchema);
