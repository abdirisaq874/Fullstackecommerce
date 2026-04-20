import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DomainEventDocument = HydratedDocument<DomainEvent>;

@Schema({ timestamps: true, collection: 'domain_events' })
export class DomainEvent {
  @Prop({ required: true, index: true })
  eventType: string;

  @Prop({ required: true })
  aggregateType: string;

  @Prop({ type: Types.ObjectId })
  aggregateId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ default: false, index: true })
  published: boolean;

  @Prop()
  publishedAt?: Date;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop()
  error?: string;
}

export const DomainEventSchema = SchemaFactory.createForClass(DomainEvent);

DomainEventSchema.index({ published: 1, createdAt: 1 });
