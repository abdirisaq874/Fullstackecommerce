/**
 * Backfill: normalize the catalog to English-canonical + normalized attributes.
 *   node dist/database/normalize-catalog.js            # all un-normalized active products
 *   LIMIT=20 node dist/database/normalize-catalog.js   # first 20 (for validation)
 *
 * Resumable: only touches products without `normalizedAt`, so a kill just resumes.
 * Run it with TRANSLATION_ENABLED=0 EMBEDDINGS_PROVIDER=none for a FAST text+attribute
 * pass (Somali re-translation + English re-embedding are a separate pass).
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { ProductNormalizationService } from '../products/product-normalization.service';
import { IndexingService } from '../search-engine/indexing/indexing.service';

const CONCURRENCY = parseInt(process.env.CONCURRENCY || '6', 10);
const LIMIT = parseInt(process.env.LIMIT || '0', 10);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const model = app.get<Model<Product>>(getModelToken(Product.name));
  const norm = app.get(ProductNormalizationService);
  const indexing = app.get(IndexingService);

  if (!norm.enabled) throw new Error('normalization disabled (no OpenRouter key)');

  const filter: any = { isDeleted: { $ne: true }, status: 'active', normalizedAt: { $exists: false } };
  let query = model.find(filter).select('+rawAttributes');
  if (LIMIT) query = query.limit(LIMIT);
  const products = await query.exec();
  console.log(`normalizing ${products.length} products (concurrency ${CONCURRENCY}, model ${norm.model})…`);

  let done = 0;
  let failed = 0;
  const worker = async (p: any) => {
    try {
      const n = await norm.normalize({
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        attributes: p.attributes,
      });
      if (!n) {
        failed++;
        return;
      } // leave unmarked → retried on next run
      const src = n.sourceLang && n.sourceLang !== 'en' ? n.sourceLang : 'tr';
      p.localizations = p.localizations || {};
      if (!p.localizations[src]?.name) {
        p.localizations[src] = { name: p.name, shortDescription: p.shortDescription, description: p.description };
      }
      p.localizations.en = { name: n.name, shortDescription: n.shortDescription, description: n.description };
      p.localizationMeta = p.localizationMeta || {};
      p.localizationMeta.en = { source: 'machine', translatedAt: new Date(), model: norm.model };
      if (!p.rawAttributes || !p.rawAttributes.length) p.rawAttributes = p.attributes;
      p.attributes = n.attributes;
      p.name = n.name; // canonical English becomes the primary name
      p.normalizedAt = new Date();
      p.embeddingInput = undefined; // mark for re-embed from English (separate pass)
      p.markModified('localizations');
      p.markModified('localizationMeta');
      await p.save();
      await indexing.indexProduct(String(p._id));
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${products.length}…`);
    } catch (e) {
      failed++;
      console.error(`  fail ${p._id}: ${(e as Error).message}`);
    }
  };

  const queue = [...products];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const p = queue.shift();
        if (p) await worker(p);
      }
    }),
  );

  console.log(`✅ normalized ${done}, failed ${failed}, remaining unmarked will retry next run`);
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('normalize-catalog failed:', e);
  process.exit(1);
});
