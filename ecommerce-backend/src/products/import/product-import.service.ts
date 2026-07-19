import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { ImportJob, ImportJobDocument } from '../schemas/import-job.schema';
import { parseImportFile } from './product-import.parser';
import { PRODUCT_IMPORT_QUEUE, IMPORT_PRODUCT_JOB } from './product-import.constants';

@Injectable()
export class ProductImportService {
  constructor(
    @InjectQueue(PRODUCT_IMPORT_QUEUE) private readonly queue: Queue,
    @InjectModel(ImportJob.name) private readonly jobModel: Model<ImportJobDocument>,
  ) {}

  /**
   * Parse the uploaded file, create a job record, and enqueue one queue job per
   * product. Returns immediately with the jobId; the portal polls for progress.
   */
  async parseAndEnqueue(
    file: { buffer: Buffer; originalname: string },
    sellerId: string,
  ): Promise<{ jobId: string; total: number; skipped: number }> {
    if (!file?.buffer?.length) throw new BadRequestException('Uploaded file is empty.');

    let parsed;
    try {
      parsed = parseImportFile(file.buffer);
    } catch (e) {
      throw new BadRequestException(`Could not parse file: ${(e as Error).message}`);
    }
    if (!parsed.products.length) {
      const why = parsed.errors.slice(0, 5).map((e) => e.message).join('; ');
      throw new BadRequestException(`No valid products found. ${why}`.trim());
    }

    const job = await this.jobModel.create({
      sellerId: new Types.ObjectId(sellerId),
      filename: file.originalname,
      status: 'processing',
      total: parsed.products.length,
      skipped: parsed.errors.length,
      errors: parsed.errors
        .slice(0, 200)
        .map((e) => ({ handle: e.handle, name: e.name, stage: 'parse', message: e.message })),
    });
    const jobId = job._id.toString();

    for (const product of parsed.products) {
      await this.queue.add(
        IMPORT_PRODUCT_JOB,
        { jobId, sellerId, product },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 4000 },
          removeOnComplete: true,
          removeOnFail: 500,
        },
      );
    }

    return { jobId, total: parsed.products.length, skipped: parsed.errors.length };
  }

  async getJob(jobId: string, sellerId: string): Promise<ImportJob> {
    if (!Types.ObjectId.isValid(jobId)) throw new NotFoundException('Import job not found');
    const job = await this.jobModel
      .findOne({ _id: jobId, sellerId: new Types.ObjectId(sellerId) })
      .lean();
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }
}
