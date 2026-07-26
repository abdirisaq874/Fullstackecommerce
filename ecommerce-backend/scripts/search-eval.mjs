#!/usr/bin/env node
/**
 * Search relevance eval harness.
 *
 *   node scripts/search-eval.mjs [apiBase] [--json]
 *   API_BASE=https://api.gaarsiiglobal.com/api/v1 node scripts/search-eval.mjs
 *
 * No human labels required — it uses cheap, checkable proxies per query:
 *   • relevant@5  : fraction of top-5 whose name/slug hits a "relevant" keyword
 *   • noise@5     : # of top-5 that hit a known-irrelevant keyword (earbuds in a shoe search…)
 *   • gender/price: constraint compliance where the query implies one
 *   • xlingual    : top-10 id overlap across en/so/tr variants of the SAME intent
 *   • latency, zero-result
 * Directional, not perfect — but stable enough to compare before/after a change.
 */
const API_BASE = process.argv.find((a) => a.startsWith('http')) || process.env.API_BASE || 'https://api.gaarsiiglobal.com/api/v1';
const AS_JSON = process.argv.includes('--json');
const K = 5;

// ---- golden set --------------------------------------------------------------
// group = intent (for cross-lingual overlap). relevant/noise = case-insensitive
// substrings matched against name+slug (incl. Turkish/Somali words).
const SHOE = ['shoe', 'ayakkab', 'sneaker', 'kabo', 'loafer', 'babet', 'terlik', 'topuk', 'bot', 'boot'];
const NOISE_ACCESSORY = ['earbud', 'kulaklık', 'headphone', 'watch', 'saat', 'phone', 'telefon', 'parfüm', 'parfum', 'speaker', 'makine', 'machine', 'cap', 'şapka', 'tutucu', 'holder'];
const WOMEN = ['kadın', 'women', 'woman', 'dumar', 'bayan'];
const MEN = ['erkek', 'men', 'man', 'rag'];

const GOLDEN = [
  { q: 'black shoes for women', locale: 'en', group: 'womens_shoes', relevant: SHOE, noise: NOISE_ACCESSORY, gender: 'women' },
  { q: 'kabo dumarka madow', locale: 'so', group: 'womens_shoes', relevant: SHOE, noise: NOISE_ACCESSORY, gender: 'women' },
  { q: 'siyah kadın ayakkabı', locale: 'tr', group: 'womens_shoes', relevant: SHOE, noise: NOISE_ACCESSORY, gender: 'women' },

  { q: "men's shoes", locale: 'en', group: 'mens_shoes', relevant: SHOE, noise: NOISE_ACCESSORY, gender: 'men' },
  { q: 'kabo raga', locale: 'so', group: 'mens_shoes', relevant: SHOE, noise: NOISE_ACCESSORY, gender: 'men' },

  { q: 'black shoes', locale: 'en', group: 'black_shoes', relevant: SHOE, noise: NOISE_ACCESSORY },
  { q: 'running shoes', locale: 'en', group: 'running_shoes', relevant: SHOE, noise: NOISE_ACCESSORY },

  { q: 'wireless headphones', locale: 'en', group: 'headphones', relevant: ['headphone', 'earbud', 'kulaklık', 'earphone'], noise: [...SHOE, 'watch', 'saat'] },
  { q: 'phone', locale: 'en', group: 'phone', relevant: ['phone', 'telefon', 'smartphone'], noise: [...SHOE, 'earbud'] },
  { q: 'taleefan', locale: 'so', group: 'phone', relevant: ['phone', 'telefon', 'smartphone'], noise: [...SHOE] },
  { q: 'watch', locale: 'en', group: 'watch', relevant: ['watch', 'saat'], noise: [...SHOE, 'phone', 'earbud'] },

  { q: 'shoes under 20 dollars', locale: 'en', group: 'cheap_shoes', relevant: SHOE, noise: NOISE_ACCESSORY, priceMax: 20 },
  { q: 'cheap phone under 100', locale: 'en', group: 'cheap_phone', relevant: ['phone', 'telefon'], noise: [...SHOE], priceMax: 100 },

  { q: 'something to hold my phone on my desk', locale: 'en', group: 'phone_holder', relevant: ['tutucu', 'holder', 'stand', 'mount'], noise: [...SHOE, 'parfüm'] },
];

// ---- helpers -----------------------------------------------------------------
const hit = (text, kws) => kws.some((k) => text.includes(k.toLowerCase()));

async function search(q, locale) {
  const url = `${API_BASE}/catalog/search?` + new URLSearchParams({ q, locale, limit: '10' });
  const t0 = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - t0;
  const json = await res.json();
  const b = json.data ?? json;
  const items = (b.data ?? []).map((x) => ({
    id: x.id,
    name: (x.name || '').toLowerCase(),
    slug: (x.slug || '').toLowerCase(),
    price: x.price,
  }));
  return { total: b.meta?.total ?? 0, items, ms, understood: b.query?.understood };
}

function scoreQuery(g, r) {
  const topK = r.items.slice(0, K);
  const text = (it) => `${it.name} ${it.slug}`;
  const rel = topK.filter((it) => hit(text(it), g.relevant)).length;
  const noise = topK.filter((it) => hit(text(it), g.noise || [])).length;
  const relAtK = topK.length ? rel / topK.length : 0;
  let genderOk = null, priceOk = null;
  if (g.gender) {
    const want = g.gender === 'women' ? WOMEN : MEN;
    const bad = g.gender === 'women' ? MEN : WOMEN;
    const shoeRows = topK.filter((it) => hit(text(it), g.relevant));
    const good = shoeRows.filter((it) => hit(text(it), want) && !hit(text(it), bad)).length;
    genderOk = shoeRows.length ? good / shoeRows.length : 0;
  }
  if (g.priceMax != null) {
    const priced = topK.filter((it) => typeof it.price === 'number');
    priceOk = priced.length ? priced.filter((it) => it.price <= g.priceMax).length / priced.length : 0;
  }
  return { relAtK, noise, genderOk, priceOk, zero: r.total === 0, ms: r.ms, total: r.total, topNames: topK.map((i) => i.name.slice(0, 40)) };
}

function jaccardTop10(a, b) {
  const A = new Set(a.slice(0, 10)), B = new Set(b.slice(0, 10));
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
}

// ---- run ---------------------------------------------------------------------
const rows = [];
const byGroup = {};
for (const g of GOLDEN) {
  const r = await search(g.q, g.locale);
  const s = scoreQuery(g, r);
  rows.push({ g, s });
  (byGroup[g.group] ||= []).push(r.items.map((i) => i.id));
}

const xling = Object.entries(byGroup)
  .filter(([, lists]) => lists.length > 1)
  .map(([grp, lists]) => {
    let sum = 0, n = 0;
    for (let i = 0; i < lists.length; i++) for (let j = i + 1; j < lists.length; j++) { sum += jaccardTop10(lists[i], lists[j]); n++; }
    return { grp, overlap: n ? sum / n : 0 };
  });

const meanRel = rows.reduce((a, r) => a + r.s.relAtK, 0) / rows.length;
const totalNoise = rows.reduce((a, r) => a + r.s.noise, 0);
const zeros = rows.filter((r) => r.s.zero).length;
const meanMs = Math.round(rows.reduce((a, r) => a + r.s.ms, 0) / rows.length);
const genderRows = rows.filter((r) => r.s.genderOk != null);
const meanGender = genderRows.length ? genderRows.reduce((a, r) => a + r.s.genderOk, 0) / genderRows.length : null;
const priceRows = rows.filter((r) => r.s.priceOk != null);
const meanPrice = priceRows.length ? priceRows.reduce((a, r) => a + r.s.priceOk, 0) / priceRows.length : null;
const meanXling = xling.length ? xling.reduce((a, x) => a + x.overlap, 0) / xling.length : null;

if (AS_JSON) {
  console.log(JSON.stringify({ meanRel, totalNoise, zeros, meanMs, meanGender, meanPrice, meanXling, xling }, null, 2));
} else {
  console.log(`\n=== Search Eval @ ${API_BASE} ===`);
  console.log('query'.padEnd(38), 'rel@5  noise  gen   price  total  ms');
  for (const { g, s } of rows) {
    console.log(
      `${g.locale}:${g.q}`.slice(0, 37).padEnd(38),
      `${s.relAtK.toFixed(2)}   ${s.noise}      ${s.genderOk == null ? ' -  ' : s.genderOk.toFixed(2)}  ${s.priceOk == null ? ' -  ' : s.priceOk.toFixed(2)}   ${String(s.total).padStart(4)}  ${s.ms}`,
    );
  }
  console.log('\n--- cross-lingual top-10 overlap (higher = more consistent) ---');
  for (const x of xling) console.log(`  ${x.grp.padEnd(16)} ${x.overlap.toFixed(2)}`);
  console.log('\n================ SCORECARD ================');
  console.log(`  relevance@5 (mean)     : ${meanRel.toFixed(3)}   ← higher better`);
  console.log(`  noise items (total)    : ${totalNoise}         ← lower better`);
  console.log(`  gender match (mean)    : ${meanGender == null ? 'n/a' : meanGender.toFixed(3)}`);
  console.log(`  price compliance (mean): ${meanPrice == null ? 'n/a' : meanPrice.toFixed(3)}`);
  console.log(`  x-lingual overlap (mean): ${meanXling == null ? 'n/a' : meanXling.toFixed(3)}   ← higher better`);
  console.log(`  zero-result queries    : ${zeros}`);
  console.log(`  latency (mean ms)      : ${meanMs}`);
  console.log('==========================================\n');
}
