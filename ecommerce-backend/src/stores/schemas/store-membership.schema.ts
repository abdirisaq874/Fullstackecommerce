import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoreMembershipDocument = HydratedDocument<StoreMembership>;

// Store roles, most→least privileged. Enforcement:
//   owner   — everything, incl. delete/archive store, manage payouts & members
//   manager — manage products, orders, inventory, settings, invite staff
//   staff   — manage products, orders, inventory (no settings/members/payouts)
export enum StoreRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  STAFF = 'staff',
}

export enum MembershipStatus {
  ACTIVE = 'active',
  INVITED = 'invited', // invite created; awaiting acceptance (used once email lands)
  REVOKED = 'revoked',
}

/** Links a User to a Store with a per-store role — the staff/multi-user model. */
@Schema({ timestamps: true, collection: 'store_memberships' })
export class StoreMembership {
  @Prop({ type: Types.ObjectId, ref: 'Store', required: true, index: true })
  storeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ enum: StoreRole, required: true, default: StoreRole.STAFF })
  role: StoreRole;

  @Prop({ enum: MembershipStatus, default: MembershipStatus.ACTIVE, index: true })
  status: MembershipStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;

  @Prop() acceptedAt?: Date;
}

export const StoreMembershipSchema = SchemaFactory.createForClass(StoreMembership);
// One membership per (store, user).
StoreMembershipSchema.index({ storeId: 1, userId: 1 }, { unique: true });
// Fast "my stores" lookup.
StoreMembershipSchema.index({ userId: 1, status: 1 });
