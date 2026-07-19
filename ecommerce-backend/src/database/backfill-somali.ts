/**
 * Standalone, resumable Somali backfill. Runs OFF the prod container (straight
 * against Atlas) so it survives service restarts. Only fills products missing
 * `localizations.so` (idempotent — safe to re-run until complete). Paced + 429
 * retry to respect Gemini free-tier limits.
 *
 *   MONGODB_URI=... GEMINI_API_KEY=... npx ts-node src/database/backfill-somali.ts
 *   DRY=1 ... (just count what's missing)
 *
 * NB: updates Mongo only (product display). Run `npm run search:reindex` after to
 * push Somali into OpenSearch for search — that pass does no translation (so is
 * already present) so it's fast and quota-free.
 */
import mongoose from 'mongoose';

const KEY = process.env.GEMINI_API_KEY || '';
const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
const MODEL = process.env.GEMINI_TRANSLATION_MODEL || 'gemini-3.5-flash';
const MIN_INTERVAL = Number(process.env.TRANSLATION_MIN_INTERVAL_MS || 4500);
const FIELDS = ['name', 'shortDescription', 'description'] as const;
const SYS = [
  'You are a professional Somali ecommerce translator.', '',
  'Translate ecommerce product content from English to Somali.', '',
  'Rules:',
  '- Use natural Somali language used by online shops.',
  '- Preserve brand names exactly.',
  '- Do not translate product models, SKUs, serial numbers, measurements, or technical codes.',
  '- Keep the meaning accurate.',
  '- Do not add marketing claims that are not present.',
  '- Make translations suitable for product listings.',
  '- Return ONLY valid JSON.',
].join('\n');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function translate(fields: Record<string, string>): Promise<Record<string, string> | null> {
  const input = Object.fromEntries(Object.entries(fields).filter(([, v]) => v && String(v).trim()));
  if (!Object.keys(input).length) return null;
  const user =
    `Translate the VALUES of this JSON object from "en" to "so". ` +
    `Return ONLY a JSON object with the SAME keys and the translated values.\n\n` +
    JSON.stringify(input);
  for (let a = 0; a < 4; a += 1) {
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, temperature: 0.2,
          messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }],
        }),
      });
      if (res.status === 429) {
        const t = await res.text();
        if (/PerDay/i.test(t)) throw new Error('DAILY_QUOTA_EXHAUSTED'); // no point retrying a daily cap
        if (a < 3) { await sleep(30000); continue; } return null;
      }
      if (!res.ok) { if (a < 3) { await sleep(2000 * (a + 1)); continue; } return null; }
      const j: any = await res.json();
      let c: string = j?.choices?.[0]?.message?.content || '';
      c = c.replace(/```json/g, '').replace(/```/g, '').trim();
      const slice = c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1);
      const parsed = JSON.parse(slice);
      const out: Record<string, string> = {};
      for (const k of Object.keys(input)) if (typeof parsed[k] === 'string' && parsed[k].trim()) out[k] = parsed[k].trim();
      return Object.keys(out).length ? out : null;
    } catch { if (a < 3) { await sleep(3000); continue; } return null; }
  }
  return null;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string, { dbName: process.env.MONGODB_DB_NAME || 'ecommerce' });
  const col = mongoose.connection.collection('products');
  const filter: Record<string, any> = {
    status: 'active',
    isDeleted: { $ne: true },
    $or: [{ 'localizations.so.name': { $exists: false } }, { 'localizations.so.name': '' }, { 'localizations.so.name': null }],
  };
  // Optional: scope the backfill to a single seller (SELLER_ID env).
  if (process.env.SELLER_ID) filter.sellerId = new mongoose.Types.ObjectId(process.env.SELLER_ID);
  const total = await col.countDocuments(filter);
  console.log(`Products missing Somali: ${total}`);
  if (process.env.DRY) { await mongoose.disconnect(); return; }

  const docs = await col.find(filter, { projection: { name: 1, shortDescription: 1, description: 1, localizations: 1 } }).toArray();
  let done = 0, failed = 0, n = 0;
  for (const d of docs as any[]) {
    n += 1;
    const en = d.localizations?.en || {};
    const src = {
      name: en.name || d.name || '',
      shortDescription: en.shortDescription || d.shortDescription || '',
      description: en.description || d.description || '',
    };
    let t: Record<string, string> | null;
    try {
      t = await translate(src);
    } catch (e) {
      if ((e as Error).message === 'DAILY_QUOTA_EXHAUSTED') {
        console.log(`\n⛔ Gemini free-tier DAILY quota exhausted — stopping at ${done} translated. Re-run after the daily reset to continue (idempotent).`);
        break;
      }
      throw e;
    }
    if (t) {
      const set: Record<string, any> = { 'localizationMeta.so': { source: 'machine', translatedAt: new Date(), model: MODEL } };
      for (const f of FIELDS) if (t[f]) set[`localizations.so.${f}`] = t[f];
      await col.updateOne({ _id: d._id }, { $set: set });
      done += 1;
    } else failed += 1;
    if (n % 10 === 0 || n === docs.length) console.log(`[${n}/${docs.length}] translated=${done} failed=${failed}`);
    await sleep(MIN_INTERVAL);
  }
  console.log(`\n✅ Somali backfill done: translated ${done}, failed ${failed} (re-run to retry failures).`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error('backfill failed:', e); process.exit(1); });
