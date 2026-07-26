/**
 * Refresh the search index for the now English-canonical catalog. In-place (no
 * recreate) so storefront search is never blank:
 *   node dist/database/reindex-english.js
 *   LIMIT=20 node dist/database/reindex-english.js   # first 20 active (validation)
 *
 * Does three things at once:
 *   #2e re-embed from English — clears embeddingInput so ensureEmbedding rebuilds
 *       the vector from localizations.en (was built from pre-translation Turkish).
 *   #2f re-translate Somali    — deletes stale localizations.so so fillLocaleGaps
 *       re-translates it from the English base (it only fills MISSING fields).
 *   #1c prune stale docs       — indexProduct() removes archived/draft/deleted from
 *       the index, so the ~1k stale twins left by the English migration disappear.
 *
 * Resumable: re-running is safe (idempotent upserts; already-fresh docs are cheap).
 * Requires embeddings + translation enabled in the environment (prod default).
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { IndexingService } from '../search-engine/indexing/indexing.service';

const CONCURRENCY = parseInt(process.env.CONCURRENCY || '6', 10);
const LIMIT = parseInt(process.env.LIMIT || '0', 10);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const products = app.get<Model<Product>>(getModelToken(Product.name));
  const indexing = app.get(IndexingService);

  // #2e + #2f: clear stale Somali + embedding hash on active products so the
  // reindex re-translates Somali and re-embeds from English.
  const cleared = await products.updateMany(
    { isDeleted: { $ne: true }, status: 'active' },
    { $unset: { 'localizations.so': '', 'localizationMeta.so': '', embeddingInput: '' } },
  );
  console.log(`cleared stale .so + embeddingInput on ${cleared.modifiedCount} active products`);

  // Iterate ALL non-hard-deleted products: active → reindexed (re-embed + re-translate),
  // archived/draft → removed from the index (#1c prune). indexProduct() decides.
  const ids: string[] = (
    await products.find({}).select('_id').limit(LIMIT || 0).lean()
  ).map((p: any) => String(p._id));
  console.log(`reindexing/pruning ${ids.length} products (concurrency ${CONCURRENCY})…`);

  let done = 0;
  let failed = 0;
  const queue = [...ids];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const id = queue.shift();
        if (!id) continue;
        try {
          await indexing.indexProduct(id);
          done++;
          if (done % 100 === 0) console.log(`  ${done}/${ids.length}…`);
        } catch (e) {
          failed++;
          console.error(`  fail ${id}: ${(e as Error).message}`);
        }
      }
    }),
  );

  console.log(`✅ reindex-english done: processed ${done}, failed ${failed}`);
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('reindex-english failed:', e);
  process.exit(1);
});
