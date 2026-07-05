/**
 * Backfill semantic embeddings for every category (Qwen3-Embedding-8B via
 * OpenRouter), stored on Category.embedding — powers product auto-classification.
 * Embeds the category NAME-PATH (e.g. "Electronics > Audio > Headphones").
 * Idempotent: re-running overwrites. Run via Cloud Build (reaches Atlas + OpenRouter).
 */
import 'reflect-metadata';
import mongoose from 'mongoose';
import { CategorySchema } from '../products/schemas/product.schema';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const d = require('dotenv');
  d.config();
} catch {
  /* optional */
}

const DIM = 1024;
const BATCH = 32;
const BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const MODEL = process.env.OPENROUTER_EMBED_MODEL || 'qwen/qwen3-embedding-8b';

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  const rows: any[] = (json.data || []).slice().sort((a: any, b: any) => a.index - b.index);
  return rows.map((r) => normalize((r.embedding as number[]).slice(0, DIM)));
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey || apiKey.startsWith('PLACEHOLDER')) throw new Error('OPENROUTER_API_KEY not set');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';
  const dbName = process.env.MONGODB_DB_NAME || 'ecommerce';
  await mongoose.connect(uri, { dbName });
  const Category = mongoose.model('Category', CategorySchema);

  const cats = await Category.find({ isActive: true }).select('name ancestors').lean();
  const nameById = new Map(cats.map((c: any) => [String(c._id), c.name as string]));
  const targets = cats.map((c: any) => ({
    id: c._id,
    text: [...(c.ancestors || []).map((a: any) => nameById.get(String(a)) || ''), c.name]
      .filter(Boolean)
      .join(' > '),
  }));
  console.log(`Embedding ${targets.length} categories (model ${MODEL}, dim ${DIM})…`);

  const store: { path: string; vec: number[] }[] = [];
  let done = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    try {
      const vecs = await embedBatch(slice.map((t) => t.text), apiKey);
      const ops = slice.map((t, j) => ({
        updateOne: { filter: { _id: t.id }, update: { $set: { embedding: vecs[j] } } },
      }));
      await Category.bulkWrite(ops);
      slice.forEach((t, j) => store.push({ path: t.text, vec: vecs[j] }));
      done += slice.length;
      if (done % 320 === 0 || done === targets.length) console.log(`  ${done}/${targets.length}`);
    } catch (e) {
      console.error(`  batch @${i} failed: ${(e as Error).message}`);
    }
  }

  const withEmb = await Category.countDocuments({ embedding: { $exists: true, $ne: null } });
  console.log(`✅ Done. ${withEmb}/${targets.length} categories now have embeddings.`);

  // ── Self-test: show which categories the embeddings pick for sample products ──
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  const samples = [
    'Aurora wireless noise-cancelling headphones',
    'Organic green tea, 100 tea bags',
    "Men's waterproof trail running shoes",
    'Baby stroller with car seat',
  ];
  console.log('\n── classification self-test (top 3 by cosine) ──');
  for (const s of samples) {
    try {
      const [q] = await embedBatch([s], apiKey);
      const top = store
        .map((c) => ({ path: c.path, score: dot(q, c.vec) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      console.log(`\n"${s}"`);
      top.forEach((t) => console.log(`   ${t.score.toFixed(3)}  ${t.path}`));
    } catch (e) {
      console.log(`  (sample failed: ${(e as Error).message})`);
    }
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Embedding backfill failed:', e);
  process.exit(1);
});
