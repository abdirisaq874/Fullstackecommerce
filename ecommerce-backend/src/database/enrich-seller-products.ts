/**
 * Backfill AI enrichment over a seller's products using the same ProductAiService
 * the seller form uses: real description/shortDescription/tags/keywords, a leaf
 * category (embeddings + LLM re-rank), and a product embedding (for related +
 * semantic search). Turkish source names → English copy (vision uses the photo).
 *
 *   BACKFILL_SELLER=ilyas BACKFILL_LIMIT=20 CONCURRENCY=6 ts-node enrich-seller-products.ts
 *   (BACKFILL_LIMIT=0 → all of the seller's products)
 * Run via Cloud Build (Atlas + OpenRouter). Reindex afterwards to push vectors.
 */
import 'reflect-metadata';
import mongoose, { Types } from 'mongoose';
import { createHash } from 'crypto';
import { ProductSchema, CategorySchema } from '../products/schemas/product.schema';
import { SellerSettingsSchema } from '../seller-settings/schemas/seller-settings.schema';
import { ProductAiService } from '../products/product-ai.service';

try { require('dotenv').config(); } catch { /* optional */ }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let a = 0; a < tries; a += 1) {
    try { return await fn(); } catch (e) { last = e; await sleep(1200 * (a + 1)); }
  }
  throw last;
}

async function main() {
  const sellerSlug = process.env.BACKFILL_SELLER || 'ilyas';
  const limit = parseInt(process.env.BACKFILL_LIMIT || '20', 10); // 0 = all
  // Hosted models are slow/rate-limited — keep concurrency low to avoid timeouts.
  const concurrency = Math.max(1, parseInt(process.env.CONCURRENCY || '3', 10));

  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: process.env.MONGODB_DB_NAME || 'ecommerce' });
  const Product = mongoose.model('Product', ProductSchema);
  const Category = mongoose.model('Category', CategorySchema);
  const SellerSettings = mongoose.model('SellerSettings', SellerSettingsSchema);
  const svc = new ProductAiService(Category as any);
  if (!svc.enabled) throw new Error('OPENROUTER_API_KEY not set — AI disabled.');

  const settings = await SellerSettings.findOne({ 'storeProfile.slug': sellerSlug }).select('sellerId').lean();
  if (!settings) throw new Error(`Seller "${sellerSlug}" not found`);
  const sellerId = (settings as any).sellerId;

  // Resumable: only products not yet enriched (no embedding stored yet).
  const q = Product.find({ sellerId, status: 'active', isDeleted: { $ne: true }, embedding: { $exists: false } })
    .select('name shortDescription attributes images categoryId').sort({ _id: 1 });
  if (limit > 0) q.limit(limit);
  const products = await q.lean();
  const remaining = await Product.countDocuments({ sellerId, status: 'active', isDeleted: { $ne: true }, embedding: { $exists: false } });
  console.log(`Enriching ${products.length} products for "${sellerSlug}" (concurrency ${concurrency}); ${remaining} still un-enriched.`);

  let done = 0; let failed = 0; const samples: string[] = [];
  for (let i = 0; i < products.length; i += concurrency) {
    const chunk = products.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (p: any) => {
      try {
        const attrs = (p.attributes || []).filter((a: any) => a.key && a.value).slice(0, 8);
        // Lean path: 2 API calls per product — text-only enrich + one embedding
        // that also drives category (cosine nearest, no extra call).
        const enriched = await withRetry(() => svc.enrich({ name: p.name, attributes: attrs }));
        const embedText = `${p.name}. ${enriched.shortDescription || ''}`.trim();
        const vecF = await withRetry(() => svc.embed(embedText));
        const cat = await svc.nearestCategory(vecF);
        const upd: any = {
          description: enriched.description || p.name,
          shortDescription: enriched.shortDescription || p.shortDescription || p.name.slice(0, 160),
          tags: enriched.tags || [],
          keywords: enriched.keywords || [],
          embedding: Array.from(vecF),
          embeddingModel: 'qwen3-embedding-8b:1024',
          embeddingInput: createHash('sha1').update(embedText).digest('hex'),
          embeddedAt: new Date(),
        };
        if (cat?.categoryId) upd.categoryId = new Types.ObjectId(cat.categoryId);
        await Product.updateOne({ _id: p._id }, { $set: upd });
        done += 1;
        if (samples.length < 6) samples.push(`• ${p.name.slice(0, 40)}\n    cat: ${cat?.categoryPath || '(none)'}\n    short: ${(enriched.shortDescription || '').slice(0, 110)}\n    tags: ${(enriched.tags || []).slice(0, 6).join(', ')}`);
      } catch (e) {
        failed += 1;
        console.error(`  ✗ ${p.name?.slice(0, 40)}: ${(e as Error).message}`);
      }
    }));
    if ((i / concurrency) % 5 === 0) console.log(`  …${done + failed}/${products.length}`);
  }

  console.log(`\n✅ Enriched ${done}, failed ${failed}.`);
  console.log('\n── sample results ──\n' + samples.join('\n'));
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error('Enrich failed:', e); process.exit(1); });
