/**
 * Create Ilyas's store and import all products from trendyol-products.csv under
 * it. Idempotent: wipes + re-inserts Ilyas's products on each run.
 *   Run via Cloud Build (has the CSV file + Atlas access).
 *
 * NOTE: inserts directly (no product.created events) — run the search reindex
 * afterwards so the imported products are searchable.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ProductSchema, CategorySchema } from '../products/schemas/product.schema';
import { UserSchema } from '../users/schemas/user.schema';
import { SellerSettingsSchema } from '../seller-settings/schemas/seller-settings.schema';

try { require('dotenv').config(); } catch { /* optional */ }

const SELLER = {
  email: 'ilyas@suuq.store', firstName: 'Ilyas', lastName: 'Store', password: 'StorePass1!',
  displayName: "Ilyas Store", slug: 'ilyas', country: 'TR',
  logoUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200',
};

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

/** RFC-4180 CSV parser (handles quoted fields, embedded commas/newlines/quotes). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: process.env.MONGODB_DB_NAME || 'ecommerce' });
  const User = mongoose.model('User', UserSchema);
  const SellerSettings = mongoose.model('SellerSettings', SellerSettingsSchema);
  const Product = mongoose.model('Product', ProductSchema);
  const Category = mongoose.model('Category', CategorySchema);

  // 1) Ilyas seller + store profile
  const hash = await bcrypt.hash(SELLER.password, 10);
  const user = await User.findOneAndUpdate(
    { email: SELLER.email },
    { $set: { firstName: SELLER.firstName, lastName: SELLER.lastName, role: 'seller', isActive: true, emailVerified: true }, $setOnInsert: { email: SELLER.email, password: hash } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await SellerSettings.updateOne(
    { sellerId: user._id },
    { $set: { storeProfile: { displayName: SELLER.displayName, slug: SELLER.slug, logoUrl: SELLER.logoUrl, country: SELLER.country, currency: 'USD' } } },
    { upsert: true },
  );
  console.log(`✓ store "${SELLER.displayName}" (${user._id})`);

  // 2) category name → id (case-insensitive)
  const cats = await Category.find({ isActive: true }).select('name').lean();
  const catByName = new Map(cats.map((c: any) => [String(c.name).toLowerCase().trim(), c._id]));
  const fallbackCat = cats[0]?._id;

  // 3) parse CSV
  const csvPath = ['trendyol-products.csv', '../trendyol-products.csv', path.join(process.cwd(), 'trendyol-products.csv')].find((p) => fs.existsSync(p));
  if (!csvPath) throw new Error('trendyol-products.csv not found');
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const [cN, cSku, cSize, cPrice, cOld, cCat, cUrl, cImg, cColor, cProp] =
    ['Name', 'SKU', 'Size', 'Price', 'OldPrice', 'Category', 'SourceURL', 'CDNImages', 'ColorVariants', 'Properties'].map(col);

  const docs: any[] = [];
  const seenSlugs = new Set<string>();
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || !r[cN]) continue;
    const name = r[cN].trim();
    const price = parseFloat(String(r[cPrice]).replace(/[^0-9.]/g, ''));
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const old = parseFloat(String(r[cOld] || '').replace(/[^0-9.]/g, ''));
    const sku = String(r[cSku] || `IL-${i}`).trim();
    let slug = `${slugify(name)}-${slugify(sku)}`;
    if (seenSlugs.has(slug)) slug = `${slug}-${i}`;
    seenSlugs.add(slug);

    const images = String(r[cImg] || '')
      .split(/[\s|;]+/).map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u)).slice(0, 8)
      .map((url, idx) => ({ url, isPrimary: idx === 0, sortOrder: idx }));
    if (!images.length) images.push({ url: `https://picsum.photos/seed/${slug}/800/800`, isPrimary: true, sortOrder: 0 });

    const attributes: { key: string; value: string }[] = [];
    const parts = String(r[cProp] || '').split('|').map((p) => p.trim()).filter(Boolean);
    for (let p = 0; p + 1 < parts.length && attributes.length < 15; p += 2) {
      if (parts[p] && parts[p + 1]) attributes.push({ key: parts[p], value: parts[p + 1] });
    }
    if (r[cSize]?.trim()) attributes.unshift({ key: 'Size', value: r[cSize].trim() });

    docs.push({
      name,
      slug,
      sellerId: user._id,
      categoryId: catByName.get(String(r[cCat] || '').toLowerCase().trim()) || fallbackCat,
      shortDescription: name.slice(0, 160),
      description: name,
      basePrice: price,
      compareAtPrice: Number.isFinite(old) && old > price ? old : undefined,
      currency: 'USD',
      stock: 25 + ((i * 13) % 200),
      status: 'active',
      avgRating: 0,
      reviewCount: 0,
      totalSold: 0,
      attributes,
      images,
    });
  }

  // 4) replace Ilyas's products
  await Product.deleteMany({ sellerId: user._id });
  let created = 0;
  for (let i = 0; i < docs.length; i += 200) {
    const batch = docs.slice(i, i + 200);
    try {
      const res = await Product.insertMany(batch, { ordered: false });
      created += res.length;
    } catch (e: any) {
      created += e?.result?.result?.nInserted ?? e?.insertedDocs?.length ?? 0;
    }
  }
  const total = await Product.countDocuments({ sellerId: user._id });
  console.log(`✅ Imported ${created}/${docs.length} products for "${SELLER.displayName}" (store now has ${total}).`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error('Import failed:', e); process.exit(1); });
