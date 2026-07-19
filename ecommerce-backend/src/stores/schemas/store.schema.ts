import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoreDocument = HydratedDocument<Store>;

export enum StoreStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

// ─── Embedded settings (migrated from SellerSettings; now per-store) ───
@Schema({ _id: false })
export class StorePayouts {
  @Prop() stripeConnectAccountId?: string;
  @Prop({ enum: ['stripe', 'bank', 'paypal'] }) payoutMethod?: string;
  @Prop() bankAccountLast4?: string;
  @Prop({ enum: ['weekly', 'biweekly', 'monthly'], default: 'weekly' }) payoutSchedule: string;
}
export const StorePayoutsSchema = SchemaFactory.createForClass(StorePayouts);

@Schema({ _id: false })
export class StoreTax {
  @Prop() taxId?: string;
  @Prop({ default: false }) taxExempt: boolean;
  @Prop({ type: Number }) defaultTaxRate?: number;
}
export const StoreTaxSchema = SchemaFactory.createForClass(StoreTax);

@Schema({ _id: false })
export class StoreNotificationPrefs {
  @Prop({ default: true }) newOrderEmail: boolean;
  @Prop({ default: true }) lowStockEmail: boolean;
  @Prop({ default: true }) returnRequestEmail: boolean;
  @Prop({ default: true }) messageEmail: boolean;
}
export const StoreNotificationPrefsSchema = SchemaFactory.createForClass(StoreNotificationPrefs);

@Schema({ _id: false })
export class StoreShippingDefaults {
  @Prop({ type: Types.ObjectId }) defaultZoneId?: Types.ObjectId;
  @Prop({ default: 1 }) defaultHandlingDays: number;
}
export const StoreShippingDefaultsSchema = SchemaFactory.createForClass(StoreShippingDefaults);

// ─── Store (a seller's storefront; a user may own/manage several) ───
@Schema({ timestamps: true, collection: 'stores' })
export class Store {
  // The user who created/owns the store. Membership (incl. this owner) lives in
  // the StoreMembership collection; ownerId is the immutable creator/root owner.
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  displayName: string;

  // Globally unique, URL-safe. Used for public storefront /s/:slug.
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug: string;

  @Prop() logoUrl?: string;
  @Prop() country?: string;
  @Prop({ default: 'USD' }) currency: string;
  @Prop() supportEmail?: string;
  @Prop() supportPhone?: string;

  @Prop({ enum: StoreStatus, default: StoreStatus.ACTIVE, index: true })
  status: StoreStatus;

  // Per-store settings (payouts are per store — product decision).
  @Prop({ type: StorePayoutsSchema, default: () => ({}) })
  payouts: StorePayouts;

  @Prop({ type: StoreTaxSchema, default: () => ({}) })
  tax: StoreTax;

  @Prop({ type: StoreNotificationPrefsSchema, default: () => ({}) })
  notifications: StoreNotificationPrefs;

  @Prop({ type: StoreShippingDefaultsSchema, default: () => ({}) })
  shippingDefaults: StoreShippingDefaults;

  @Prop({ default: 'en' })
  preferredLanguage: string;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
// slug already unique via @Prop; explicit index kept for clarity + case-insensitive lookups.
StoreSchema.index({ slug: 1 }, { unique: true });
StoreSchema.index({ ownerId: 1, status: 1 });
