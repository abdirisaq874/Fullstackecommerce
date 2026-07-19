import * as XLSX from 'xlsx';

/**
 * Parses a bulk-import spreadsheet (CSV or XLSX) into products + variants.
 *
 * Format: one row per variant; rows sharing the same `handle` belong to one
 * product. The first row of a handle carries the product-level fields; every
 * row (incl. the first) may define a variant via the option* columns. A product
 * with no variants is a single row with the option columns left blank.
 *
 * Description, shortDescription, tags, keywords and category are intentionally
 * NOT read here — the store AI always generates them at import time.
 */

export interface ParsedVariant {
  sku?: string;
  name?: string;
  options: { name: string; value: string }[];
  priceOverride?: number;
  barcode?: string;
  weightGrams?: number;
  imageUrl?: string;
}

export interface ParsedProduct {
  handle: string;
  name: string;
  brand?: string;
  basePrice: number;
  compareAtPrice?: number;
  currency?: string;
  stock?: number;
  status?: string;
  imageUrls: string[];
  sourceUrl?: string;
  attributes: { key: string; value: string }[];
  variants: ParsedVariant[];
}

export interface ParseError {
  handle?: string;
  name?: string;
  message: string;
}

export interface ParseResult {
  products: ParsedProduct[];
  errors: ParseError[];
}

const STATUSES = ['draft', 'active', 'archived'];

const toNum = (v: unknown): number | undefined => {
  if (v === undefined || v === null || String(v).trim() === '') return undefined;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

/** Lowercase + trim every header so column matching is case-insensitive. */
function normRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    out[k.toLowerCase().trim()] = row[k] == null ? '' : String(row[k]).trim();
  }
  return out;
}

function readOptions(r: Record<string, string>): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const i of [1, 2, 3]) {
    const name = r[`option${i}name`];
    const value = r[`option${i}value`];
    if (name && value) out.push({ name, value });
  }
  return out;
}

function readAttributes(s: string): { key: string; value: string }[] {
  if (!s) return [];
  return s
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const idx = p.indexOf(':');
      if (idx < 0) return null;
      return { key: p.slice(0, idx).trim(), value: p.slice(idx + 1).trim() };
    })
    .filter((x): x is { key: string; value: string } => !!x && !!x.key && !!x.value);
}

function readUrls(s: string): string[] {
  if (!s) return [];
  return s
    .split(/[|\n]/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

export function parseImportFile(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { products: [], errors: [{ message: 'No sheet found in file' }] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
    defval: '',
    raw: false,
  });

  const byHandle = new Map<string, ParsedProduct>();

  rows.forEach((raw, i) => {
    const r = normRow(raw);
    const name = r['name'];
    const handleKey = r['handle'] || (name ? slugify(name) : '') || `row-${i + 2}`;

    let p = byHandle.get(handleKey);
    if (!p) {
      p = {
        handle: handleKey,
        name: name || '',
        brand: r['brand'] || undefined,
        basePrice: toNum(r['baseprice']) ?? NaN,
        compareAtPrice: toNum(r['compareatprice']),
        currency: r['currency'] || undefined,
        stock: toNum(r['stock']),
        status: STATUSES.includes((r['status'] || '').toLowerCase())
          ? (r['status'] || '').toLowerCase()
          : undefined,
        imageUrls: readUrls(r['imageurls']),
        sourceUrl: r['sourceurl'] || undefined,
        attributes: readAttributes(r['attributes']),
        variants: [],
      };
      byHandle.set(handleKey, p);
    } else {
      // continuation row — fill product-level gaps only
      if (!p.name && name) p.name = name;
      if (p.imageUrls.length === 0) p.imageUrls = readUrls(r['imageurls']);
    }

    const options = readOptions(r);
    const variantSku = r['variantsku'];
    const variantImage = r['variantimageurl'];
    if (options.length || variantSku) {
      p.variants.push({
        sku: variantSku || undefined,
        name: options.map((o) => o.value).join(' / ') || undefined,
        options,
        priceOverride: toNum(r['variantprice']),
        barcode: r['variantbarcode'] || undefined,
        weightGrams: toNum(r['variantweightgrams']),
        imageUrl: /^https?:\/\//i.test(variantImage) ? variantImage : undefined,
      });
    }
    if (/^https?:\/\//i.test(variantImage) && !p.imageUrls.includes(variantImage)) {
      p.imageUrls.push(variantImage);
    }
  });

  const products: ParsedProduct[] = [];
  const errors: ParseError[] = [];
  for (const p of byHandle.values()) {
    if (!p.name) {
      errors.push({ handle: p.handle, message: 'Missing product name' });
      continue;
    }
    if (!Number.isFinite(p.basePrice)) {
      errors.push({ handle: p.handle, name: p.name, message: 'Missing or invalid basePrice' });
      continue;
    }
    products.push(p);
  }
  return { products, errors };
}
