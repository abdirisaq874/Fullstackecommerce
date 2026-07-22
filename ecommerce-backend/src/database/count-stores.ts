/**
 * Read-only report: how many stores (users with role 'seller') exist, plus
 * each store's product count. Does NOT modify anything.
 *   Run: npx ts-node src/database/count-stores.ts
 *   Needs env MONGODB_URI (and optionally MONGODB_DB_NAME, default 'ecommerce').
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { ProductSchema } from '../products/schemas/product.schema';
import { UserSchema } from '../users/schemas/user.schema';

try { require('dotenv').config(); } catch { /* optional */ }

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME || 'ecommerce',
  });

  const User = mongoose.model('User', UserSchema);
  const Product = mongoose.model('Product', ProductSchema);

  const storeCount = await User.countDocuments({ role: 'seller' });
  const distinctOwners = (await Product.distinct('sellerId')).filter(Boolean);
  const totalProducts = await Product.countDocuments({});

  console.log(`\n=== STORE REPORT ===`);
  console.log(`Stores (users with role 'seller'): ${storeCount}`);
  console.log(`Sellers that actually own products: ${distinctOwners.length}`);
  console.log(`Total products in system: ${totalProducts}\n`);

  const sellers = await User.find({ role: 'seller' }).lean();
  for (const s of sellers as any[]) {
    const count = await Product.countDocuments({ sellerId: s._id });
    const name =
      s.displayName ||
      `${s.firstName || ''} ${s.lastName || ''}`.trim() ||
      '(no name)';
    console.log(`  • ${name}  <${s.email}>  — ${count} products`);
  }

  console.log('');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});