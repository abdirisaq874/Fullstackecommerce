import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteMiddleware } from '../../shared/database/base.schema';

export type MessageDocument = HydratedDocument<Message>;

export const MESSAGE_AUTHOR_ROLES = ['seller', 'customer', 'admin', 'system'] as const;
export type MessageAuthorRole = typeof MESSAGE_AUTHOR_ROLES[number];

@Schema({ _id: true })
export class MessageAttachment {
  _id: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  contentType?: string;

  @Prop({ type: Number, min: 0 })
  sizeBytes?: number;
}
export const MessageAttachmentSchema = SchemaFactory.createForClass(MessageAttachment);

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'MessageThread', required: true, index: true })
  threadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ enum: MESSAGE_AUTHOR_ROLES, required: true })
  authorRole: MessageAuthorRole;

  @Prop({ required: true })
  body: string;

  @Prop({ type: [MessageAttachmentSchema], default: [] })
  attachments: MessageAttachment[];

  @Prop({ type: Date })
  readBySellerAt?: Date;

  @Prop({ type: Date })
  readByCustomerAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Listing messages within a thread sorted oldest→newest (or reversed) is the
// dominant access pattern, so cover it explicitly.
MessageSchema.index({ threadId: 1, createdAt: 1 });
MessageSchema.index({ threadId: 1, createdAt: -1 });

applySoftDeleteMiddleware(MessageSchema);
