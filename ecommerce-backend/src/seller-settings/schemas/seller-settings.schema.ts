import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// ─── Store Profile (embedded) ───
@Schema({ _id: false })
export class StoreProfile {
  @Prop() displayName?: string;
  @Prop() slug?: string;
  @Prop() logoUrl?: string;
  @Prop() country?: string;
  @Prop({ default: 'USD' }) currency: string;
  @Prop() supportEmail?: string;
  @Prop() supportPhone?: string;
}
export const StoreProfileSchema = SchemaFactory.createForClass(StoreProfile);

// ─── Payouts (embedded) ───
@Schema({ _id: false })
export class Payouts {
  @Prop() stripeConnectAccountId?: string;
  @Prop({ enum: ['stripe', 'bank', 'paypal'] }) payoutMethod?: string;
  @Prop() bankAccountLast4?: string;
  @Prop({ enum: ['weekly', 'biweekly', 'monthly'], default: 'weekly' })
  payoutSchedule: string;
}
export const PayoutsSchema = SchemaFactory.createForClass(Payouts);

// ─── Tax (embedded) ───
@Schema({ _id: false })
export class TaxSettings {
  @Prop() taxId?: string;
  @Prop({ default: false }) taxExempt: boolean;
  @Prop({ type: Number }) defaultTaxRate?: number;
}
export const TaxSettingsSchema = SchemaFactory.createForClass(TaxSettings);

// ─── Notifications (embedded) ───
@Schema({ _id: false })
export class NotificationPrefs {
  @Prop({ default: true }) newOrderEmail: boolean;
  @Prop({ default: true }) lowStockEmail: boolean;
  @Prop({ default: true }) returnRequestEmail: boolean;
  @Prop({ default: true }) messageEmail: boolean;
}
export const NotificationPrefsSchema = SchemaFactory.createForClass(NotificationPrefs);

// ─── Shipping Defaults (embedded) ───
@Schema({ _id: false })
export class ShippingDefaults {
  @Prop({ type: Types.ObjectId }) defaultZoneId?: Types.ObjectId;
  @Prop({ default: 1 }) defaultHandlingDays: number;
}
export const ShippingDefaultsSchema = SchemaFactory.createForClass(ShippingDefaults);

// ─── Main SellerSettings ───
export type SellerSettingsDocument = HydratedDocument<SellerSettings>;

@Schema({ timestamps: true, collection: 'seller_settings' })
export class SellerSettings {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ type: StoreProfileSchema, default: () => ({}) })
  storeProfile: StoreProfile;

  @Prop({ type: PayoutsSchema, default: () => ({}) })
  payouts: Payouts;

  @Prop({ type: TaxSettingsSchema, default: () => ({}) })
  tax: TaxSettings;

  @Prop({ type: NotificationPrefsSchema, default: () => ({}) })
  notifications: NotificationPrefs;

  @Prop({ type: ShippingDefaultsSchema, default: () => ({}) })
  shippingDefaults: ShippingDefaults;

  @Prop({ default: 'en' })
  preferredLanguage: string;
}

export const SellerSettingsSchema = SchemaFactory.createForClass(SellerSettings);

// Indexes
SellerSettingsSchema.index({ sellerId: 1 }, { unique: true });
