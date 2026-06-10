import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteMiddleware } from '../../shared/database/base.schema';

export type MessageThreadDocument = HydratedDocument<MessageThread>;

export const THREAD_STATUS = ['open', 'closed'] as const;
export type ThreadStatus = typeof THREAD_STATUS[number];

@Schema({ timestamps: true, collection: 'message_threads' })
export class MessageThread {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ type: Date, default: () => new Date(), index: true })
  lastMessageAt: Date;

  @Prop({ default: '', maxlength: 120 })
  lastMessagePreview: string;

  @Prop({ default: 0, min: 0 })
  unreadCountSeller: number;

  @Prop({ default: 0, min: 0 })
  unreadCountCustomer: number;

  @Prop({ type: Types.ObjectId, ref: 'Order' })
  relatedOrderId?: Types.ObjectId;

  @Prop({ enum: THREAD_STATUS, default: 'open', index: true })
  status: ThreadStatus;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export const MessageThreadSchema = SchemaFactory.createForClass(MessageThread);

// Compound indexes for the most common access patterns:
//   - "list my threads, newest first"  → (sellerId, lastMessageAt desc)
//   - "list my threads, newest first"  → (customerId, lastMessageAt desc)
MessageThreadSchema.index({ sellerId: 1, lastMessageAt: -1 });
MessageThreadSchema.index({ customerId: 1, lastMessageAt: -1 });
MessageThreadSchema.index({ sellerId: 1, status: 1, lastMessageAt: -1 });
MessageThreadSchema.index({ customerId: 1, status: 1, lastMessageAt: -1 });

applySoftDeleteMiddleware(MessageThreadSchema);
