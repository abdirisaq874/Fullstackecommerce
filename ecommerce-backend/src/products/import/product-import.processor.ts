import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
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
@Processor(PRODUCT_IMPORT_QUEUE, { concurrency: 3 })
export class ProductImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductImportProcessor.name);

  constructor(
    private readonly products: ProductService,
    private readonly ai: ProductAiService,
    private readonly uploads: UploadsService,
    @InjectModel(ImportJob.name) private readonly jobModel: Model<ImportJobDocument>,
  ) {
    super();
  }

  async process(job: Job<ImportProductJob>): Promise<void> {
    if (job.name !== IMPORT_PRODUCT_JOB) return;
    const { jobId, sellerId, product } = job.data;

    // If the seller cancelled this import, skip every remaining queued product
    // (products already created stay). Cheap status check before any image/AI work.
    const parent = await this.jobModel.findById(jobId).select('status').lean();
    if (!parent || parent.status === 'cancelled') return;

    try {
      // 1. Rehost images → R2 (retry transient timeouts; keep only successes).
      //    Tag each image with the COLOUR it belongs to (altText = colour value)
      //    so the storefront can switch the gallery per colour; product-level
      //    images fall back to the product name. De-dupe by source URL.
      const colorOptOf = (opts: { name: string; value: string }[] | undefined) =>
        opts?.find((o) => /^(colou?r|renk)$/i.test(o.name));
      type ImgSpec = { url: string; altText: string; appliesTo?: { name: string; value: string }[] };
      const specs: ImgSpec[] = [];
      const seen = new Set<string>();
      // Product-level images (from `imageUrls`) are the PRIMARY colour's photos
      // — the first variant's colour. Tag them with that colour so the storefront
      // switches them off when another colour is picked (instead of treating them
      // as shared and showing them for every colour). Colourless products keep
      // them un-tagged (truly shared).
      const primaryColor = product.variants
        .map((v) => colorOptOf(v.options))
        .find((c): c is { name: string; value: string } => !!c);
      for (const url of product.imageUrls) {
        if (url && !seen.has(url)) {
          seen.add(url);
          specs.push({
            url,
            altText: primaryColor?.value || product.name,
            ...(primaryColor ? { appliesTo: [{ name: primaryColor.name, value: primaryColor.value }] } : {}),
          });
        }
      }
      for (const v of product.variants) {
        const c = colorOptOf(v.options);
        // Structured variant-image association (feature B): every image on this
        // variant row is shown for its colour. Supports MANY images per colour.
        for (const url of v.imageUrls || []) {
          if (url && !seen.has(url)) {
            seen.add(url);
            specs.push({
              url,
              altText: c?.value || product.name,
              appliesTo: c ? [{ name: c.name, value: c.value }] : undefined,
            });
          }
        }
      }
      const images: (ImgSpec & { isPrimary: boolean; sortOrder: number })[] = [];
      for (const spec of specs) {
        try {
          const url = await this.retry(() => this.uploads.putRemoteImage(spec.url, 'product'));
          images.push({
            url,
            altText: spec.altText,
            ...(spec.appliesTo ? { appliesTo: spec.appliesTo } : {}),
            isPrimary: images.length === 0,
            sortOrder: images.length,
          });
        } catch (e) {
          this.logger.warn(`image rehost failed (${spec.url}): ${(e as Error).message}`);
        }
      }

      // 2. AI draft — description + category are mandatory (retry transient failures)
      const draft = await this.retry(() =>
        this.ai.draft({
          name: product.name,
          brand: product.brand,
          attributes: product.attributes,
          imageUrl: images[0]?.url,
        }),
      );
      if (!draft.categoryId) throw new Error('AI could not assign a category');

      // 3. Build the product payload
      const variants = product.variants.map((v, i) => ({
        sku: v.sku || `${product.handle}-${i + 1}`.toUpperCase().slice(0, 40),
        name: v.name,
        options: v.options,
        priceOverride: v.priceOverride,
        barcode: v.barcode,
        weightGrams: v.weightGrams,
        // Per-variant stock → create() seeds per-SKU Inventory (feature A parity).
        ...(typeof v.stock === 'number' ? { stock: v.stock } : {}),
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
        // Product-level stock = sum of per-variant stock when provided (matches the
        // seller-portal single-create behaviour); else the row's own stock.
        stock: variants.some((v: any) => typeof v.stock === 'number')
          ? variants.reduce((s: number, v: any) => s + (v.stock || 0), 0)
          : (product.stock ?? 0),
        status: product.status || 'draft',
        ...(product.condition ? { condition: product.condition } : {}),
        ...(product.dimensionsCm ? { packageDimensionsCm: product.dimensionsCm } : {}),
        ...(product.gtin ? { gtin: product.gtin } : {}),
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
      const message = (e as Error).message;
      this.logger.warn(`import failed for "${product.name}": ${message}`);
      await this.bump(jobId, {
        failed: 1,
        error: { handle: product.handle, name: product.name, stage: 'create', message },
        // keep the full payload so the seller can retry just this item
        failedItem: { product, message },
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
    opts: {
      created?: number;
      failed?: number;
      error?: ImportRowError;
      failedItem?: { product: ParsedProduct; message: string };
    },
  ): Promise<void> {
    const inc: Record<string, number> = { processed: 1 };
    if (opts.created) inc.created = opts.created;
    if (opts.failed) inc.failed = opts.failed;
    const update: Record<string, any> = { $inc: inc };
    const push: Record<string, any> = {};
    if (opts.error) push.errors = { $each: [opts.error], $slice: -200 };
    if (opts.failedItem) push.failedItems = { $each: [opts.failedItem], $slice: -1000 };
    if (Object.keys(push).length) update.$push = push;

    const doc = await this.jobModel.findByIdAndUpdate(jobId, update, { new: true });
    if (doc && doc.processed >= doc.total && doc.status === 'processing') {
      await this.jobModel.updateOne({ _id: jobId }, { status: 'completed' });
    }
  }
}
