/**
 * One-off fix: some bulk-imported image URLs were saved with a trailing comma
 * (e.g. ".../1_org_zoom.jpg,") from the source CSV, so those images 404/403 and
 * the colour swatches & thumbnails render broken. This trims whitespace and
 * strips trailing commas/semicolons from every stored product image URL.
 *
 *   Dry run (counts only, no writes):  DRY_RUN=1 npx ts-node src/database/clean-image-urls.ts
 *   Apply:                             npx ts-node src/database/clean-image-urls.ts
 *   In the deployed backend container: node dist/database/clean-image-urls.js
 *
 * Needs env MONGODB_URI (and optionally MONGODB_DB_NAME, default 'ecommerce').
 * Safe to re-run. Only rewrites URLs that actually change; drops an image only
 * if its URL is empty/invalid after cleaning. Scope with STORE_ID / SELLER_ID.
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { ProductSchema } from '../products/schemas/product.schema';

try {
  require('dotenv').config();
} catch {
  /* optional */
}

/** Trim + strip trailing commas/semicolons that CSV exports glue onto URLs. */
const clean = (u: unknown): string =>
  String(u ?? '')
    .trim()
    .replace(/[;,]+$/, '')
    .trim();

async function main() {
  const dry = !!process.env.DRY_RUN;
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME || 'ecommerce',
  });
  const Product = mongoose.model('Product', ProductSchema);

  const filter: Record<string, any> = { 'images.0': { $exists: true } };
  if (process.env.SELLER_ID) filter.sellerId = new mongoose.Types.ObjectId(process.env.SELLER_ID);
  if (process.env.STORE_ID) filter.storeId = new mongoose.Types.ObjectId(process.env.STORE_ID);

  let scanned = 0;
  let changedProducts = 0;
  let fixedImages = 0;
  let droppedImages = 0;

  const cursor = Product.find(filter, { images: 1 }).lean().cursor();

  for await (const p of cursor as any) {
    scanned++;
    const images: any[] = Array.isArray(p.images) ? p.images : [];
    let changed = false;
    const next: any[] = [];

    for (const img of images) {
      const original = String(img?.url ?? '');
      const cleaned = clean(original);
      if (cleaned !== original) {
        changed = true;
        fixedImages++;
      }
      if (!/^https?:\/\//i.test(cleaned)) {
        // only reachable if the URL was already junk (never from stripping a comma)
        droppedImages++;
        changed = true;
        continue;
      }
      next.push({ ...img, url: cleaned });
    }

    if (!changed) continue;

    // keep exactly one primary and tidy the sort order after any drops
    if (next.length && !next.some((i) => i.isPrimary)) next[0].isPrimary = true;
    next.forEach((i, idx) => {
      i.sortOrder = idx;
    });

    changedProducts++;
    if (!dry) {
      await Product.updateOne({ _id: p._id }, { $set: { images: next } });
    }
  }

  const verb = dry ? 'would be' : '';
  console.log(`${dry ? '[DRY RUN] ' : ''}Scanned ${scanned} products with images.`);
  console.log(`Products ${dry ? 'that would change' : 'changed'}: ${changedProducts}`);
  console.log(`Image URLs ${verb} cleaned: ${fixedImages}${droppedImages ? `, dropped (invalid): ${droppedImages}` : ''}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});