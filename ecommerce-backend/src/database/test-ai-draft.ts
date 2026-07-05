/**
 * End-to-end proof of the REAL ProductAiService.draft() pipeline:
 *   copy/tags/keywords (Gemma) + optional image→vision (Gemma) + category
 *   auto-assignment (Qwen3 embeddings → cosine top-K → Gemma re-rank).
 * Run via Cloud Build (reaches Atlas + OpenRouter). No HTTP/auth layer.
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { CategorySchema } from '../products/schemas/product.schema';
import { ProductAiService } from '../products/product-ai.service';

try { require('dotenv').config(); } catch { /* optional */ }

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, {
    dbName: process.env.MONGODB_DB_NAME || 'ecommerce',
  });
  const CategoryModel = mongoose.model('Category', CategorySchema);
  const svc = new ProductAiService(CategoryModel as any);

  const samples: { name: string; brief?: string; imageUrl?: string }[] = [
    // Text-only
    { name: 'Aurora wireless noise-cancelling headphones', brief: 'over-ear, 40h battery, USB-C' },
    // Vision: a real, publicly-fetchable product photo (headphones) → tests the image path
    { name: 'Studio headphones', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600' },
  ];

  for (const s of samples) {
    const d = await svc.draft(s);
    console.log(`\n### ${s.name}${s.imageUrl ? '  (+image)' : ''}`);
    console.log(`   ► category: ${d.categoryPath || '(none)'}`);
    console.log(`   ► short:    ${d.shortDescription}`);
    console.log(`   ► tags:     ${d.tags.join(', ')}`);
    console.log(`   ► keywords: ${d.keywords.slice(0, 8).join(', ')}`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
