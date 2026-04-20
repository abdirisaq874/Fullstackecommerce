import { Prop } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export abstract class BaseSchema {
  _id: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// Apply soft-delete middleware to any schema
export function applySoftDeleteMiddleware(schema: any) {
  // Exclude soft-deleted documents from queries by default
  schema.pre(/^find/, function (this: any, next: any) {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
    next();
  });

  schema.pre('countDocuments', function (this: any, next: any) {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
    next();
  });
}
