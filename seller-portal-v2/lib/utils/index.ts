import type { ProductOption, ProductDimension, ProductVariant, Product } from '@/lib/types';
import { CATEGORIES, BRANDS } from '@/lib/config/reference-data';

// ────────────────────────────────────────────────────────────
// Formatters
// ────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}

/**
 * Format an integer-cents money value as a localized currency string.
 *
 * Backend money fields (e.g. `amountCents`, `feeCents`, `netCents` on the
 * seller-finance endpoints) are persisted as integer cents to avoid floating
 * point drift. The UI takes them as-is and divides by 100 at render time.
 *
 * Negative inputs are preserved (used for refund rows where amounts flip sign).
 */
export function formatCurrencyCents(cents: number | null | undefined, currency = 'USD'): string {
  const value = typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}

/**
 * Render an ISO date as a short, locale-friendly "relative" hint.
 *
 * Examples (now = Jun 10 2026):
 *   "2026-06-12T00:00:00Z" → "in 2 days"
 *   "2026-06-10T00:00:00Z" → "today"
 *   "2026-06-08T00:00:00Z" → "2 days ago"
 *   undefined/invalid       → "—"
 */
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '—';
  const diffMs = target.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffDays) >= 30) {
    return rtf.format(Math.round(diffDays / 30), 'month');
  }
  if (Math.abs(diffDays) >= 7) {
    return rtf.format(Math.round(diffDays / 7), 'week');
  }
  return rtf.format(diffDays, 'day');
}

/** Short YYYY-MM-DD slice of an ISO timestamp; safe on undefined. */
export function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

// "low-stock" → "Low stock"
export function cap(s: string): string {
  return s.split('-').map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function catName(id?: string): string {
  return CATEGORIES.find(c => c.id === id)?.name ?? '—';
}

export function brandName(id?: string): string {
  return BRANDS.find(b => b.id === id)?.name ?? '—';
}

export function countryFlag(dest: string): string {
  if (!dest) return '';
  if (dest.includes('SO')) return '🇸🇴';
  if (dest.includes('KE')) return '🇰🇪';
  if (dest.includes('ET')) return '🇪🇹';
  if (dest.includes('TR')) return '🇹🇷';
  return '';
}

// ────────────────────────────────────────────────────────────
// Status / badge mapping (single source of truth)
// ────────────────────────────────────────────────────────────

export type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

export function statusVariant(status: string): BadgeVariant {
  if (['active', 'shipped', 'delivered', 'live', 'received', 'refunded', 'replied'].includes(status)) return 'success';
  if (['low-stock', 'processing', 'limited', 'picked', 'packed', 'inspected', 'requested', 'unread'].includes(status)) return 'warning';
  if (['confirmed', 'new', 'approved'].includes(status)) return 'info';
  if (['out-of-stock', 'cancelled', 'paused', 'rejected'].includes(status)) return 'danger';
  return 'neutral';
}

export function productDisplayStatus(p: Product): { label: string; variant: BadgeVariant } {
  if (p.status === 'draft')    return { label: 'Draft',        variant: 'neutral' };
  if (p.status === 'archived') return { label: 'Archived',     variant: 'neutral' };
  if (p.stock === 0)           return { label: 'Out of stock', variant: 'danger'  };
  if (p.stock !== null && p.stock <= 5) return { label: 'Low stock', variant: 'warning' };
  return { label: 'Active', variant: 'success' };
}

// ────────────────────────────────────────────────────────────
// Order flow
// ────────────────────────────────────────────────────────────

export const ORDER_FLOW = ['new', 'confirmed', 'processing', 'picked', 'packed', 'shipped', 'delivered'] as const;

export function nextOrderStatus(s: string): string | null {
  const i = ORDER_FLOW.indexOf(s as typeof ORDER_FLOW[number]);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

// ────────────────────────────────────────────────────────────
// Variants helpers (dimension/cartesian product logic)
// ────────────────────────────────────────────────────────────

export function inferDimensions(variants: ProductVariant[] | undefined): ProductDimension[] {
  if (!variants?.length) return [];
  const dims = new Map<string, Set<string>>();
  for (const v of variants) {
    for (const opt of (v.options || [])) {
      if (!opt.name || !opt.value) continue;
      if (!dims.has(opt.name)) dims.set(opt.name, new Set());
      dims.get(opt.name)!.add(opt.value);
    }
  }
  return [...dims.entries()].map(([name, vals]) => ({ name, values: [...vals] }));
}

export function cartesianOptions(dimensions: ProductDimension[]): ProductOption[][] {
  const valid = dimensions.filter(d => d.name?.trim() && d.values?.length);
  if (!valid.length) return [];
  let combos: ProductOption[][] = [[]];
  for (const dim of valid) {
    const next: ProductOption[][] = [];
    for (const c of combos) {
      for (const val of dim.values) {
        next.push([...c, { name: dim.name, value: val }]);
      }
    }
    combos = next;
  }
  return combos;
}

export function suggestSku(productName: string, options: ProductOption[]): string {
  const base = (productName || 'PRODUCT')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean).slice(0, 1)[0] || 'PRODUCT';
  const suffix = options
    .map(o => (o.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
    .filter(Boolean).join('-');
  return suffix ? `${base}-${suffix}` : base;
}

export function variantKey(options: ProductOption[]): string {
  return options.map(o => `${o.name}=${o.value}`).join('|');
}

export function regenerateVariants(
  productName: string,
  dimensions: ProductDimension[],
  existing: ProductVariant[]
): ProductVariant[] {
  const combos = cartesianOptions(dimensions);
  const existingByKey = new Map((existing || []).map(v => [variantKey(v.options || []), v]));
  return combos.map(options => {
    const key = variantKey(options);
    const found = existingByKey.get(key);
    if (found) return { ...found, options };
    return {
      sku: suggestSku(productName, options),
      stockOnHand: '',
      priceOverride: '',
      costPrice: '',
      weightGrams: '',
      options,
    };
  });
}

// ────────────────────────────────────────────────────────────
// DTO builder (CreateProductDto shape)
// ────────────────────────────────────────────────────────────

export function buildProductDto(form: any): any {
  const dto: any = { name: form.name, basePrice: Number(form.basePrice) };
  if (form.categoryId)       dto.categoryId       = form.categoryId;
  if (form.brandId)          dto.brandId          = form.brandId;
  if (form.shortDescription) dto.shortDescription = form.shortDescription;
  if (form.description)      dto.description      = form.description;
  if (form.tags?.length)     dto.tags             = form.tags;
  if (form.keywords?.length) dto.keywords         = form.keywords;
  if (form.compareAtPrice)   dto.compareAtPrice   = Number(form.compareAtPrice);
  if (form.currency)         dto.currency         = form.currency;
  if (form.status)           dto.status           = form.status;
  if (form.isFeatured)       dto.isFeatured       = true;
  if (form.condition && form.condition !== 'new') dto.condition = form.condition;
  // Package dimensions (cm) for shipping — only send the values the seller filled.
  const d = form.packageDimensionsCm || {};
  const dims: Record<string, number> = {};
  for (const k of ['length', 'width', 'height'] as const) {
    const n = Number(d[k]);
    if (Number.isFinite(n) && n > 0) dims[k] = n;
  }
  if (Object.keys(dims).length) dto.packageDimensionsCm = dims;
  // Simple stock model: one product-level quantity — sum of variant stock when the
  // product has variants, otherwise the single "stock on hand" value.
  if (form.hasVariants && form.variants?.length) {
    dto.stock = form.variants.reduce((s: number, v: any) => s + (Number(v.stockOnHand) || 0), 0);
  } else if (form.stockOnHand !== '' && form.stockOnHand != null) {
    dto.stock = Number(form.stockOnHand) || 0;
  }
  if (form.variants?.length) {
    dto.variants = form.variants.map((v: any) => {
      const o: any = { sku: v.sku };
      if (v.name)            o.name          = v.name;
      if (v.priceOverride)   o.priceOverride = Number(v.priceOverride);
      if (v.costPrice)       o.costPrice     = Number(v.costPrice);
      if (v.weightGrams)     o.weightGrams   = Number(v.weightGrams);
      if (v.barcode)         o.barcode       = v.barcode;
      if (v.options?.length) o.options       = v.options;
      // Per-variant stock → persisted to per-SKU Inventory by the backend.
      o.stock = Number(v.stockOnHand) || 0;
      return o;
    });
  }
  if (form.images?.length) {
    dto.images = form.images.map((img: any, i: number) => {
      const o: any = { url: img.url };
      if (img.altText)   o.altText   = img.altText;
      // Structured variant-image association (dimension-agnostic).
      if (img.appliesTo?.length) o.appliesTo = img.appliesTo;
      if (img.isPrimary) o.isPrimary = true;
      o.sortOrder = i;
      return o;
    });
  }
  if (form.attributes?.length) dto.attributes = form.attributes.filter((a: any) => a.key && a.value);
  if (form.metaTitle)          dto.metaTitle       = form.metaTitle;
  if (form.metaDescription)    dto.metaDescription = form.metaDescription;
  // The backend's CreateProductDto now accepts a `localizations` object
  // (en/tr/so/sw/am), so we send the per-locale translations through.
  if (form.localizations)      dto.localizations   = form.localizations;
  return dto;
}

// ────────────────────────────────────────────────────────────
// CSV utilities
// ────────────────────────────────────────────────────────────

export function toCSV<T extends Record<string, any>>(rows: T[], headers: { key: string; label: string }[]): string {
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map(h => escape(h.label)).join(',');
  const body = rows.map(r => headers.map(h => escape(r[h.key])).join(',')).join('\n');
  return head + '\n' + body;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
