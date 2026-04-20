import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { applySoftDeleteMiddleware } from '../../shared/database/base.schema';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  ADMIN = 'admin',
}

// ─── Address subdocument ───
@Schema({ _id: true, timestamps: true })
export class Address {
  _id: Types.ObjectId;

  @Prop({ enum: ['shipping', 'billing'], default: 'shipping' })
  type: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop()
  label: string; // "Home", "Office"

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  line1: string;

  @Prop()
  line2?: string;

  @Prop({ required: true })
  city: string;

  @Prop()
  state: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ required: true, maxlength: 2 })
  countryCode: string;

  @Prop()
  phone?: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

// ─── Main User schema ───
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop()
  phone?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ type: [AddressSchema], default: [] })
  addresses: Address[];

  // Virtual
  fullName?: string;

  // Soft delete
  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

// Virtual: fullName
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save: hash password
UserSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

// Method: compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Exclude password from JSON
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

applySoftDeleteMiddleware(UserSchema);
