import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model } from 'mongoose';
import { ImportJob, ImportJobDocument, ImportRowError } from '../schemas/import-job.schema';
import { ProductService } from '../product.service';
import { ProductAiService } from '../product-ai.service';
import { UploadsService } from '../../uploads/uploads.service';
import { ParsedProduct } from './product-import.parser';
import { PRODUCT_IMPORT_QUEUE, IMPORT_PRODUCT_JOB } from './product-import.constants';

interface ImportProductJob {
  jobId: string;
  sellerId: string;
  product: ParsedProduct;
}

/**
 * Per-product worker for a bulk import. For each product:
 *   1. rehost every image URL to R2 (source CDN links are never stored)
 *   2. AI draft — description/short/tags/keywords + category (mandatory)
 *   3. create via ProductService.create (fires product.created → translate + embed + index)
 *   4. atomically update the ImportJob progress counters
 */
@Processor(PRODUCT_IMPORT_QUEUE)
export class ProductImportProcessor {
  private readonly logger = new Logger(ProductImportProcessor.name);

  constructor(
    private readonly products: ProductService,
    private readonly ai: ProductAiService,
    private readonly uploads: UploadsService,
    @InjectModel(ImportJob.name) private readonly jobModel: Model<ImportJobDocument>,
  ) {}

  @Process({ name: IMPORT_PRODUCT_JOB, concurrency: 3 })
  async handle(job: Job<ImportProductJob>): Promise<void> {
    const { jobId, sellerId, product } = job.data;
    try {
      // 1. Rehost images → R2 (retry transient timeouts; keep only successes)
      const rehosted: string[] = [];
      for (const url of product.imageUrls) {
        try {
          rehosted.push(await this.retry(() => this.uploads.putRemoteImage(url, 'product')));
        } catch (e) {
          this.logger.warn(`image rehost failed (${url}): ${(e as Error).message}`);
        }
      }

      // 2. AI draft — description + category are mandatory (retry transient failures)
      const draft = await this.retry(() =>
        this.ai.draft({
          name: product.name,
          brand: product.brand,
          attributes: product.attributes,
          imageUrl: rehosted[0],
        }),
      );
      if (!draft.categoryId) throw new Error('AI could not assign a category');

      // 3. Build the product payload
      const images = rehosted.map((url, i) => ({
        url,
        altText: product.name,
        isPrimary: i === 0,
        sortOrder: i,
      }));
      const variants = product.variants.map((v, i) => ({
        sku: v.sku || `${product.handle}-${i + 1}`.toUpperCase().slice(0, 40),
        name: v.name,
        options: v.options,
        priceOverride: v.priceOverride,
        barcode: v.barcode,
        weightGrams: v.weightGrams,
        sortOrder: i,
      }));

      const dto: Record<string, any> = {
        name: product.name,
        categoryId: draft.categoryId,
        description: draft.description,
        shortDescription: draft.shortDescription,
        tags: draft.tags,
        keywords: draft.keywords,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        currency: product.currency || 'USD',
        stock: product.stock ?? 0,
        status: product.status || 'draft',
        images,
        attributes: product.attributes,
        ...(variants.length ? { variants } : {}),
      };

      await this.products.create(dto as any, sellerId, {
        importMeta: {
          sourceUrl: product.sourceUrl,
          source: 'bulk-import',
          batchId: jobId,
          importedAt: new Date(),
        },
      });

      await this.bump(jobId, { created: 1 });
    } catch (e) {
      this.logger.warn(`import failed for "${product.name}": ${(e as Error).message}`);
      await this.bump(jobId, {
        failed: 1,
        error: { handle: product.handle, name: product.name, stage: 'create', message: (e as Error).message },
      });
    }
  }

  /** Retry a transient (timeout / network / 5xx) async op with linear backoff. */
  private async retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
    let last: unknown;
    for (let i = 0; i < tries; i += 1) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw last;
  }

  /** Atomically advance the progress counters and flip status when done. */
  private async bump(
    jobId: string,
    opts: { created?: number; failed?: number; error?: ImportRowError },
  ): Promise<void> {
    const inc: Record<string, number> = { processed: 1 };
    if (opts.created) inc.created = opts.created;
    if (opts.failed) inc.failed = opts.failed;
    const update: Record<string, any> = { $inc: inc };
    if (opts.error) update.$push = { errors: { $each: [opts.error], $slice: -200 } };

    const doc = await this.jobModel.findByIdAndUpdate(jobId, update, { new: true });
    if (doc && doc.processed >= doc.total && doc.status === 'processing') {
      await this.jobModel.updateOne({ _id: jobId }, { status: 'completed' });
    }
  }
}
