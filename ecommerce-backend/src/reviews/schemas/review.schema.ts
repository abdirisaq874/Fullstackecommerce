import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop() authorName?: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop() title?: string;
  @Prop() body?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// One review per user per product (re-submitting updates the existing one).
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
ReviewSchema.index({ productId: 1, createdAt: -1 });
