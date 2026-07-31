/**
 * One-off fix: products bulk-imported with a blank `stock` column were created
 * with stock 0 (schema default), so they show "Out of stock" everywhere.
 * This sets stock = STOCK_QTY (default 100) for every product currently at 0.
 *
 *   Run: STOCK_QTY=100 npx ts-node src/database/set-stock.ts
 *   Needs env MONGODB_URI (and optionally MONGODB_DB_NAME, default 'ecommerce').
 *
 * Safe to re-run. Only touches products with stock <= 0 (won't overwrite real
 * stock levels). Scope to one store by setting STORE_ID / SELLER_ID (optional).
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { ProductSchema } from '../products/schemas/product.schema';

try { require('dotenv').config(); } catch { /* optional */ }

async function main() {
  const qty = Number(process.env.STOCK_QTY || 100);
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME || 'ecommerce',
  });
  const Product = mongoose.model('Product', ProductSchema);

  // Optional scoping — set STORE_ID or SELLER_ID to limit the fix to one store.
  const filter: Record<string, any> = { stock: { $lte: 0 } };
  if (process.env.SELLER_ID) filter.sellerId = new mongoose.Types.ObjectId(process.env.SELLER_ID);
  if (process.env.STORE_ID) filter.storeId = new mongoose.Types.ObjectId(process.env.STORE_ID);

  const before = await Product.countDocuments(filter);
  console.log(`Products at stock <= 0${process.env.SELLER_ID || process.env.STORE_ID ? ' (scoped)' : ''}: ${before}`);

  if (before === 0) {
    console.log('Nothing to update.');
  } else {
    const res = await Product.updateMany(filter, { $set: { stock: qty } });
    console.log(`Updated ${res.modifiedCount} products → stock = ${qty}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});