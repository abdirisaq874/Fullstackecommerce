/**
 * Seed sample products so the storefront (featured / new / bestsellers rails,
 * category pages) has real content. Idempotent: re-running replaces them by slug.
 *
 * Run: npx ts-node src/database/seed-products.ts   (reads MONGODB_URI/DB_NAME from env)
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { ProductSchema, CategorySchema } from '../products/schemas/product.schema';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const d = require('dotenv');
  d.config();
  d.config({ path: '.env.local' });
} catch {
  /* optional */
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// cat = a top-level Google-taxonomy slug to attach to (falls back to any category)
const ITEMS: Array<{
  name: string; price: number; was?: number; sold: number; rating: number; reviews: number; featured?: boolean; cat: string; blurb: string;
}> = [
  { name: 'Aurora Wireless Headphones', price: 129, was: 159, sold: 1840, rating: 4.6, reviews: 842, featured: true, cat: 'electronics', blurb: 'Active noise cancelling, 40h battery, plush memory-foam ear cups.' },
  { name: 'Pulse Smartwatch 2', price: 199, was: 229, sold: 1210, rating: 4.7, reviews: 512, featured: true, cat: 'electronics', blurb: 'AMOLED display, GPS, heart-rate & SpO₂, 7-day battery.' },
  { name: 'Mecha 75% Keyboard', price: 119, sold: 640, rating: 4.8, reviews: 301, featured: true, cat: 'electronics', blurb: 'Hot-swap switches, gasket mount, RGB, USB-C.' },
  { name: 'Nebula ANC Earbuds', price: 89, was: 109, sold: 2310, rating: 4.5, reviews: 1204, cat: 'electronics', blurb: 'Compact ANC earbuds with wireless charging case.' },
  { name: 'Merino Crew Sweater', price: 74, sold: 980, rating: 4.9, reviews: 311, featured: true, cat: 'apparel-and-accessories', blurb: '100% extra-fine merino wool, breathable and soft.' },
  { name: 'Everyday Denim Jacket', price: 98, was: 120, sold: 420, rating: 4.4, reviews: 176, cat: 'apparel-and-accessories', blurb: 'Structured mid-wash denim with a relaxed fit.' },
  { name: 'Trail Runner GTX', price: 140, sold: 1520, rating: 4.7, reviews: 690, featured: true, cat: 'sporting-goods', blurb: 'Waterproof trail shoe with grippy lugged outsole.' },
  { name: 'Yoga Mat Pro 6mm', price: 39, was: 49, sold: 2100, rating: 4.6, reviews: 880, cat: 'sporting-goods', blurb: 'Non-slip, cushioned, eco TPE mat with carry strap.' },
  { name: 'Ceramic Pour-Over Set', price: 42, sold: 560, rating: 4.5, reviews: 96, cat: 'home-and-garden', blurb: 'Hand-glazed dripper + carafe for a clean, bright cup.' },
  { name: 'Handwoven Wool Throw', price: 120, was: 150, sold: 240, rating: 4.9, reviews: 64, featured: true, cat: 'home-and-garden', blurb: 'Chunky, cozy throw woven from natural wool.' },
  { name: 'Stoneware Dinner Set (12pc)', price: 95, sold: 380, rating: 4.6, reviews: 142, cat: 'furniture', blurb: 'Reactive-glaze stoneware, dishwasher & microwave safe.' },
  { name: 'Oak Bedside Table', price: 160, was: 189, sold: 130, rating: 4.7, reviews: 51, cat: 'furniture', blurb: 'Solid oak nightstand with a soft-close drawer.' },
  { name: 'Vitamin-C Glow Serum', price: 28, sold: 3400, rating: 4.5, reviews: 2210, featured: true, cat: 'health-and-beauty', blurb: '15% vitamin C + hyaluronic acid for a brighter look.' },
  { name: 'Silk Pillowcase', price: 34, was: 44, sold: 900, rating: 4.8, reviews: 410, cat: 'health-and-beauty', blurb: '22-momme mulberry silk, kinder to skin and hair.' },
  { name: 'Wooden Blocks (100pc)', price: 32, sold: 720, rating: 4.9, reviews: 260, cat: 'toys-and-games', blurb: 'FSC-certified beech blocks in a cotton storage bag.' },
  { name: 'Remote Control Rover', price: 59, was: 79, sold: 480, rating: 4.3, reviews: 158, cat: 'toys-and-games', blurb: 'All-terrain RC car, 2.4GHz, rechargeable battery.' },
  { name: 'Weekender Duffel Bag', price: 88, sold: 610, rating: 4.7, reviews: 233, featured: true, cat: 'luggage-and-bags', blurb: 'Water-resistant canvas duffel with shoe compartment.' },
  { name: 'Instant Camera Mini', price: 69, was: 85, sold: 1330, rating: 4.4, reviews: 540, cat: 'cameras-and-optics', blurb: 'Point-and-shoot instant prints with selfie mirror.' },
];

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
  const dbName = process.env.MONGODB_DB_NAME || 'ecommerce';
  await mongoose.connect(uri, { dbName });
  const Product = mongoose.model('Product', ProductSchema);
  const Category = mongoose.model('Category', CategorySchema);

  const cats = await Category.find({ isActive: true }).select('slug').lean();
  const bySlug = new Map(cats.map((c: any) => [c.slug, c._id]));
  const fallback = cats[0]?._id;
  if (!fallback) throw new Error('No categories found — seed the taxonomy first.');

  const docs = ITEMS.map((it, i) => {
    const slug = slugify(it.name);
    return {
      name: it.name,
      slug,
      categoryId: bySlug.get(it.cat) ?? fallback,
      shortDescription: it.blurb,
      description: it.blurb,
      basePrice: it.price,
      compareAtPrice: it.was,
      currency: 'USD',
      stock: 50 + ((i * 7) % 150),
      status: 'active',
      isFeatured: !!it.featured,
      avgRating: it.rating,
      reviewCount: it.reviews,
      totalSold: it.sold,
      images: [{ url: `https://picsum.photos/seed/${slug}/800/800`, isPrimary: true, sortOrder: 0 }],
    };
  });

  const slugs = docs.map((d) => d.slug);
  await Product.deleteMany({ slug: { $in: slugs } });
  await Product.insertMany(docs, { ordered: false });

  const total = await Product.countDocuments({ status: 'active' });
  console.log(`✅ Seeded ${docs.length} products (${total} active total in "${dbName}").`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Product seed failed:', e);
  process.exit(1);
});
