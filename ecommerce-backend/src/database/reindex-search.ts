/**
 * Rebuild the OpenSearch product index from MongoDB.
 *   npm run search:reindex              # ensure index exists, (re)index all active products
 *   npm run search:reindex -- --recreate  # drop + recreate the index first (mapping changes)
 *
 * Runs the full enrichment per product (translate missing locales → embed →
 * index), so it doubles as the one-time backfill.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IndexingService } from '../search-engine/indexing/indexing.service';

async function main() {
  const recreate = process.argv.includes('--recreate');
  const sellerId = process.env.SELLER_ID || undefined; // optional: scope to one seller
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const indexing = app.get(IndexingService);

  console.log(`Reindexing products${sellerId ? ` (seller ${sellerId})` : ''}${recreate ? ' (recreate index)' : ''}…`);
  const { indexed } = await indexing.reindexAll({ recreate, sellerId });
  console.log(`✅ Reindex complete: ${indexed} products indexed.`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Reindex failed:', err);
  process.exit(1);
});
