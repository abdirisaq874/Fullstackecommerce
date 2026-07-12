/**
 * Non-destructive: re-parse trendyol-products.csv and tag each product's images
 * with their colour (ProductImage.altText = colour) so the storefront gallery
 * can switch per selected colour. Only $sets `images` — leaves enrichment
 * (description/category/embedding) and variants untouched. Idempotent.
 *   Run via Cloud Build from the REPO ROOT (needs the CSV).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { ProductSchema } from '../products/schemas/product.schema';
import { SellerSettingsSchema } from '../seller-settings/schemas/seller-settings.schema';

try { require('dotenv').config(); } catch { /* optional */ }

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  const sellerSlug = process.env.BACKFILL_SELLER || 'ilyas';
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: process.env.MONGODB_DB_NAME || 'ecommerce' });
  const Product = mongoose.model('Product', ProductSchema);
  const SellerSettings = mongoose.model('SellerSettings', SellerSettingsSchema);
  const settings = await SellerSettings.findOne({ 'storeProfile.slug': sellerSlug }).select('sellerId').lean();
  if (!settings) throw new Error(`Seller "${sellerSlug}" not found`);
  const sellerId = (settings as any).sellerId;

  const csvPath = ['trendyol-products.csv', '../trendyol-products.csv'].find((p) => fs.existsSync(p));
  if (!csvPath) throw new Error('trendyol-products.csv not found');
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf-8'));
  const header = rows[0].map((h) => h.trim());
  const cN = header.indexOf('Name'); const cSku = header.indexOf('SKU'); const cImg = header.indexOf('CDNImages'); const cColor = header.indexOf('ColorVariants');

  let updated = 0; let withColor = 0; const seenSlug = new Set<string>();
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i]; if (!r || !r[cN]) continue;
    const name = r[cN].trim(); const sku = String(r[cSku] || `IL-${i}`).trim();
    let slug = `${slugify(name)}-${slugify(sku)}`;
    if (seenSlug.has(slug)) slug = `${slug}-${i}`;
    seenSlug.add(slug);

    const colors = [...String(r[cColor] || '').matchAll(/([^:[\]]+):\s*\[([^\]]*)\]/g)]
      .map((m) => ({ name: m[1].replace(/^[\s|]+/, '').trim(), images: m[2].split(',').map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u)) }))
      .filter((c) => c.name);
    const cdn = String(r[cImg] || '').split(/[\s|;,]+/).map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));

    const seenImg = new Set<string>(); const imgList: { url: string; altText?: string }[] = [];
    for (const c of colors) for (const u of c.images) { if (!seenImg.has(u)) { seenImg.add(u); imgList.push({ url: u, altText: c.name }); } }
    for (const u of cdn) { if (!seenImg.has(u)) { seenImg.add(u); imgList.push({ url: u }); } }
    if (!imgList.length) continue; // keep existing placeholder
    const images = imgList.slice(0, 16).map((im, idx) => ({ ...im, isPrimary: idx === 0, sortOrder: idx }));

    const res = await Product.updateOne({ sellerId, slug }, { $set: { images } });
    if (res.matchedCount) { updated += 1; if (colors.length) withColor += 1; }
  }
  console.log(`\n✅ Tagged images on ${updated} products (${withColor} with colour-specific images).`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error('Tag failed:', e); process.exit(1); });
