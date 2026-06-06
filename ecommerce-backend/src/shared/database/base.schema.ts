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

  // Aggregation bypasses the query middleware above, so exclude soft-deleted
  // docs here too — unless the pipeline already references isDeleted, or starts
  // with a stage that must come first ($match/$search/$geoNear handled safely).
  schema.pre('aggregate', function (this: any, next: any) {
    const pipeline = this.pipeline();
    const alreadyFilters = JSON.stringify(pipeline).includes('isDeleted');
    const firstStage = pipeline[0] && Object.keys(pipeline[0])[0];
    const mustBeFirst = firstStage === '$search' || firstStage === '$geoNear';
    if (!alreadyFilters && !mustBeFirst) {
      pipeline.unshift({ $match: { isDeleted: { $ne: true } } });
    }
    next();
  });
}
