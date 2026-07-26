/**
 * Seed per-SKU Inventory records for existing variant products so per-variant
 * stock becomes independently trackable/editable.
 *   node dist/database/init-variant-inventory.js
 *
 * Idempotent + resumable: uses $setOnInsert, so existing records (with real
 * quantities) are never overwritten — only missing SKUs get a starting record,
 * initialized from the product's current single `stock` value.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Product } from '../products/schemas/product.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const products = app.get<Model<Product>>(getModelToken(Product.name));
  const inv = app.get<Model<Inventory>>(getModelToken(Inventory.name));

  const cursor = products
    .find({ isDeleted: { $ne: true }, 'variants.0': { $exists: true } })
    .cursor();

  let productCount = 0;
  let skus = 0;
  let created = 0;
  for await (const p of cursor as any) {
    productCount++;
    const stock = Math.max(0, Number((p as any).stock) || 0);
    for (const v of (p as any).variants || []) {
      if (!v?.sku) continue;
      skus++;
      const res: any = await inv.updateOne(
        { variantSku: v.sku },
        { $setOnInsert: { productId: p._id, quantity: stock, reserved: 0 } },
        { upsert: true },
      );
      if (res.upsertedCount) created++;
    }
    if (productCount % 100 === 0) console.log(`  ${productCount} products, ${created} records created…`);
  }

  console.log(`✅ done: ${productCount} variant products, ${skus} SKUs, ${created} inventory records created (existing untouched).`);
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('init-variant-inventory failed:', e);
  process.exit(1);
});
