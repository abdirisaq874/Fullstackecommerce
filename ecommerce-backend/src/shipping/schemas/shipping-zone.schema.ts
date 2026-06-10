import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseSchema, applySoftDeleteMiddleware } from '../../shared/database/base.schema';

export type ShippingZoneDocument = HydratedDocument<ShippingZone>;

@Schema({ timestamps: true, collection: 'shipping_zones' })
export class ShippingZone extends BaseSchema {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], default: [] })
  countries: string[];

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 5 })
  leadTimeDays: number;
}

export const ShippingZoneSchema = SchemaFactory.createForClass(ShippingZone);

ShippingZoneSchema.index({ sellerId: 1, active: 1 });
ShippingZoneSchema.index({ countries: 1, active: 1 });

applySoftDeleteMiddleware(ShippingZoneSchema);
