/**
 * Backfill: every product must belong to a seller. Creates a few themed seller
 * stores (loginable, with store profiles) and assigns each seller-less product
 * to a store by its top-level category. Idempotent — safe to re-run.
 *   Run via Cloud Build (reaches Atlas).
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ProductSchema, CategorySchema } from '../products/schemas/product.schema';
import { UserSchema } from '../users/schemas/user.schema';
import { SellerSettingsSchema } from '../seller-settings/schemas/seller-settings.schema';

try { require('dotenv').config(); } catch { /* optional */ }

const SHARED_PASSWORD = 'StorePass1!';

const SELLERS = [
  {
    email: 'volt.electronics@suuq.store', firstName: 'Volt', lastName: 'Electronics',
    displayName: 'Volt Electronics', slug: 'volt-electronics', country: 'US',
    logoUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200',
    categories: ['Electronics', 'Cameras & Optics'],
  },
  {
    email: 'casa.living@suuq.store', firstName: 'Casa', lastName: 'Living',
    displayName: 'Casa Living', slug: 'casa-living', country: 'IT',
    logoUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=200',
    categories: ['Home & Garden', 'Furniture', 'Health & Beauty'],
  },
  {
    email: 'peak.play@suuq.store', firstName: 'Peak', lastName: 'Play',
    displayName: 'Peak & Play', slug: 'peak-and-play', country: 'GB',
    logoUrl: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=200',
    categories: ['Apparel & Accessories', 'Sporting Goods', 'Toys & Games', 'Luggage & Bags'],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: process.env.MONGODB_DB_NAME || 'ecommerce' });
  const User = mongoose.model('User', UserSchema);
  const SellerSettings = mongoose.model('SellerSettings', SellerSettingsSchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Category = mongoose.model('Category', CategorySchema);

  const hash = await bcrypt.hash(SHARED_PASSWORD, 10);

  // 1) Upsert seller users + store profiles; build category → sellerId map.
  const catToSeller = new Map<string, mongoose.Types.ObjectId>();
  const sellerIds: mongoose.Types.ObjectId[] = [];
  for (const s of SELLERS) {
    const user = await User.findOneAndUpdate(
      { email: s.email },
      {
        $set: { firstName: s.firstName, lastName: s.lastName, role: 'seller', isActive: true, emailVerified: true },
        $setOnInsert: { email: s.email, password: hash },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await SellerSettings.updateOne(
      { sellerId: user._id },
      { $set: { storeProfile: { displayName: s.displayName, slug: s.slug, logoUrl: s.logoUrl, country: s.country, currency: 'USD' } } },
      { upsert: true },
    );
    sellerIds.push(user._id as mongoose.Types.ObjectId);
    for (const cn of s.categories) catToSeller.set(cn, user._id as mongoose.Types.ObjectId);
    console.log(`✓ store "${s.displayName}" (${user._id})`);
  }

  // 2) category id → top-level name
  const cats = await Category.find().select('name').lean();
  const nameById = new Map(cats.map((c: any) => [String(c._id), c.name as string]));

  // 3) Assign seller-less products by category (round-robin fallback).
  const products = await Product.find({ $or: [{ sellerId: { $exists: false } }, { sellerId: null }] });
  const counts: Record<string, number> = {};
  let rr = 0;
  for (const p of products as any[]) {
    const cn = nameById.get(String(p.categoryId));
    const sellerId = (cn && catToSeller.get(cn)) || sellerIds[rr++ % sellerIds.length];
    await Product.updateOne({ _id: p._id }, { $set: { sellerId } });
    counts[String(sellerId)] = (counts[String(sellerId)] || 0) + 1;
  }

  console.log(`\n✅ Assigned ${products.length} products.`);
  for (const s of SELLERS) {
    const id = catToSeller.get(s.categories[0]);
    console.log(`   ${s.displayName}: ${counts[String(id)] || 0}`);
  }
  const remaining = await Product.countDocuments({ $or: [{ sellerId: { $exists: false } }, { sellerId: null }] });
  console.log(`   products still without a seller: ${remaining}`);
  console.log(`\n   store logins: ${SELLERS.map((s) => s.email).join(', ')} / ${SHARED_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error('Backfill failed:', e); process.exit(1); });
