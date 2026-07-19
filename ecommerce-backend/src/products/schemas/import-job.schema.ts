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

  // Full parsed payloads of items that failed at the create stage, so the seller
  // can re-run just those from the portal. Cleared once retried (moved to a new
  // job) — `failed` stays as the historical count.
  @Prop({ type: [Object], default: [] })
  failedItems: { product: Record<string, any>; message: string }[];

  // Set when this job was created by "retry failed" of another job.
  @Prop({ type: Types.ObjectId, ref: 'ImportJob' })
  retryOf?: Types.ObjectId;
}

export const ImportJobSchema = SchemaFactory.createForClass(ImportJob);
