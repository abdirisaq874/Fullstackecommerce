import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserInteractionDocument = HydratedDocument<UserInteraction>;

/**
 * A user's behavioural signal toward a product — the persistent memory that powers
 * personalized "For you" recommendations. One row per (user, product, type); the
 * row's `updatedAt` is refreshed on every repeat so recency reflects the last touch.
 * Rows expire after 180 days of inactivity (TTL) to keep the profile fresh + bounded.
 */
@Schema({ timestamps: true, collection: 'user_interactions' })
export class UserInteraction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true }) productId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Category' }) categoryId?: Types.ObjectId;
  @Prop({ enum: ['view', 'cart', 'purchase'], required: true }) type: string;
}

export const UserInteractionSchema = SchemaFactory.createForClass(UserInteraction);
// One row per (user, product, type) — repeat interactions bump updatedAt, not new rows.
UserInteractionSchema.index({ userId: 1, productId: 1, type: 1 }, { unique: true });
// Recency lookups per user.
UserInteractionSchema.index({ userId: 1, updatedAt: -1 });
// TTL: drop signals not touched in 180 days.
UserInteractionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
