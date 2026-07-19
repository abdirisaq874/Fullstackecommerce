import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { Client } from '@opensearch-project/opensearch';

import { Product, Category, Brand, ProductLocale } from '../../products/schemas/product.schema';
import { OPENSEARCH_CLIENT } from '../opensearch/opensearch.constants';
import { IndexAdminService } from '../opensearch/index-admin.service';
import { TranslationService } from '../providers/translation.service';
import { EmbeddingsService } from '../providers/embeddings.service';
import { buildProductDoc } from './document-builder';

const LOCALE_FIELDS: (keyof ProductLocale)[] = ['name', 'shortDescription', 'description'];

/**
 * Owns the write path: enrich a product (translate missing locales + embed),
 * persist the enrichment back to Mongo, and upsert the document into OpenSearch.
 * Designed to run off the request path (Bull worker / cron / CLI).
 */
@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);
  private readonly locales: string[];
  private readonly baseLocale: string;

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectModel(Brand.name) private readonly brandModel: Model<Brand>,
    @Inject(OPENSEARCH_CLIENT) private readonly client: Client,
    private readonly config: ConfigService,
    private readonly indexAdmin: IndexAdminService,
    private readonly translation: TranslationService,
    private readonly embeddings: EmbeddingsService,
  ) {
    this.locales = this.config.get<string[]>('search.locales') || ['en', 'so'];
    this.baseLocale = this.config.get<string>('search.defaultLocale') || 'en';
  }

  private get index(): string {
    return this.indexAdmin.indexName;
  }

  /** Upsert one product. Removes it from the index if it's no longer searchable. */
  async indexProduct(productId: string): Promise<void> {
    const product = await this.productModel.findById(productId);
    if (!product || product.isDeleted || product.status !== 'active') {
      await this.removeProduct(productId);
      return;
    }

    await this.enrich(product);

    const [category, brand] = await Promise.all([
      product.categoryId ? this.categoryModel.findById(product.categoryId).lean() : null,
      product.brandId ? this.brandModel.findById(product.brandId).lean() : null,
    ]);

    const doc = buildProductDoc(product.toObject(), { category, brand }, this.locales, this.baseLocale);
    await this.client.index({ index: this.index, id: productId, body: doc, refresh: false });
  }

  async removeProduct(productId: string): Promise<void> {
    try {
      await this.client.delete({ index: this.index, id: productId });
    } catch {
      // 404 (not indexed) is fine
    }
  }

  /** Full rebuild — used by the reindex CLI. */
  async reindexAll(opts: { recreate?: boolean; sellerId?: string } = {}): Promise<{ indexed: number }> {
    if (opts.recreate) await this.indexAdmin.recreateIndex();
    else await this.indexAdmin.ensureIndex();

    let indexed = 0;
    const filter: Record<string, any> = { status: 'active', isDeleted: { $ne: true } };
    if (opts.sellerId) filter.sellerId = opts.sellerId; // Mongoose casts the string to ObjectId
    const cursor = this.productModel.find(filter).cursor();

    for await (const product of cursor) {
      try {
        await this.indexProduct(String(product._id));
        indexed++;
        if (indexed % 100 === 0) this.logger.log(`Indexed ${indexed} products…`);
      } catch (err) {
        this.logger.error(`Failed indexing ${product._id}: ${(err as Error).message}`);
      }
    }

    await this.client.indices.refresh({ index: this.index });
    this.logger.log(`Reindex complete: ${indexed} products.`);
    return { indexed };
  }

  // ── enrichment ───────────────────────────────────────────────────────────

  private async enrich(product: any): Promise<void> {
    let changed = false;
    if (this.translation.enabled) {
      changed = (await this.fillLocaleGaps(product)) || changed;
    }
    changed = (await this.ensureEmbedding(product)) || changed;
    if (changed) {
      product.markModified('localizations');
      product.markModified('localizationMeta');
      await product.save();
    }
  }

  /** Seed base locale from legacy flat fields, then translate gaps into the rest. */
  private async fillLocaleGaps(product: any): Promise<boolean> {
    let changed = false;
    product.localizations = product.localizations || {};

    const base = product.localizations[this.baseLocale] || {};
    for (const field of LOCALE_FIELDS) {
      if (!base[field] && product[field]) {
        base[field] = product[field];
        changed = true;
      }
    }
    product.localizations[this.baseLocale] = base;

    for (const locale of this.locales) {
      if (locale === this.baseLocale) continue;
      const loc = product.localizations[locale] || {};
      // Collect only the fields still missing for this locale, then translate
      // them in a single call (returns JSON keyed by field name).
      const missing: Record<string, string> = {};
      for (const field of LOCALE_FIELDS) {
        if (!loc[field] && base[field]) missing[field] = base[field];
      }
      if (Object.keys(missing).length) {
        const translated = await this.translation.translateFields(missing, this.baseLocale, locale);
        if (translated) {
          for (const [field, value] of Object.entries(translated)) {
            if (value) loc[field] = value;
          }
          product.localizationMeta = product.localizationMeta || {};
          product.localizationMeta[locale] = {
            source: 'machine',
            translatedAt: new Date(),
            model: this.translation.model,
          };
          changed = true;
        }
      }
      product.localizations[locale] = loc;
    }
    return changed;
  }

  private async ensureEmbedding(product: any): Promise<boolean> {
    if (!this.embeddings.enabled) return false;
    const input = this.buildEmbedInput(product);
    if (!input) return false;
    const hash = createHash('sha1').update(input).digest('hex');
    if (product.embeddingInput === hash && Array.isArray(product.embedding)) return false;

    const [vec] = await this.embeddings.embedDocuments([input]);
    if (!vec) return false;

    product.embedding = vec;
    product.embeddingModel = `${this.embeddings.provider}:${this.embeddings.dims}`;
    product.embeddingInput = hash;
    product.embeddedAt = new Date();
    return true;
  }

  private buildEmbedInput(product: any): string {
    const parts: string[] = [];
    for (const locale of this.locales) {
      const loc = product.localizations?.[locale];
      if (loc?.name) parts.push(loc.name);
      if (loc?.shortDescription) parts.push(loc.shortDescription);
    }
    if (parts.length === 0 && product.name) parts.push(product.name);
    for (const a of product.attributes || []) parts.push(`${a.key}: ${a.value}`);
    return parts.join('. ').slice(0, 4000);
  }
}
