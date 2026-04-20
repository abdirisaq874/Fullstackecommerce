// ─── schemas/notification.schema.ts ───
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) userId: Types.ObjectId;
  @Prop({ enum: ['order_update', 'promotion', 'review_approved', 'price_drop', 'system'] })
  type: string;
  @Prop({ enum: ['email', 'sms', 'push', 'in_app'], default: 'in_app' }) channel: string;
  @Prop() title: string;
  @Prop() body: string;
  @Prop() referenceType?: string;
  @Prop({ type: Types.ObjectId }) referenceId?: Types.ObjectId;
  @Prop({ default: false }) isRead: boolean;
  @Prop() sentAt?: Date;
  @Prop() readAt?: Date;
}
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default { Notification, NotificationSchema };
