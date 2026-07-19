import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ImportJobDocument = HydratedDocument<ImportJob>;

export interface ImportRowError {
  handle?: string;
  name?: string;
  stage?: string; // 'parse' | 'create'
  message: string;
}

/**
 * Tracks the progress of one bulk product-import file. One document per upload;
 * the per-product queue workers atomically $inc the counters so the seller
 * portal can poll GET /products/import/:jobId for a live progress bar.
 */
@Schema({ timestamps: true, collection: 'import_jobs' })
export class ImportJob {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  sellerId: Types.ObjectId;

  @Prop() filename?: string;

  @Prop({ enum: ['processing', 'completed', 'failed'], default: 'processing', index: true })
  status: string;

  @Prop({ default: 0 }) total: number;
  @Prop({ default: 0 }) processed: number;
  @Prop({ default: 0 }) created: number;
  @Prop({ default: 0 }) failed: number;
  @Prop({ default: 0 }) skipped: number; // rows dropped at parse time (invalid)

  @Prop({ type: [Object], default: [] })
  errors: ImportRowError[];
}

export const ImportJobSchema = SchemaFactory.createForClass(ImportJob);
