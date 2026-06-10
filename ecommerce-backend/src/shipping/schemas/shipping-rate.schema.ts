import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, applySoftDeleteMiddleware } from '../../shared/database/base.schema';

export type ShippingRateDocument = HydratedDocument<ShippingRate>;

@Schema({ timestamps: true, collection: 'shipping_rates' })
export class ShippingRate extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'ShippingZone', required: true, index: true })
  zoneId: Types.ObjectId;

  @Prop({ required: true })
  method: string;

  @Prop({ type: Number, required: true })
  baseCostCents: number;

  @Prop({ type: Number, default: 0 })
  perItemCostCents: number;

  @Prop({ type: Number, default: 0 })
  perKgCostCents: number;

  @Prop({ type: Number })
  minDeliveryDays: number;

  @Prop({ type: Number })
  maxDeliveryDays: number;

  @Prop({ default: true })
  active: boolean;
}

export const ShippingRateSchema = SchemaFactory.createForClass(ShippingRate);

ShippingRateSchema.index({ zoneId: 1, active: 1 });

applySoftDeleteMiddleware(ShippingRateSchema);
