import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Backend base URL incl. global /api/v1 prefix. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Suuq';

/** Format a price. Backend prices are in major currency units (e.g. dollars). */
export function formatPrice(amount: number | undefined, currency = 'USD'): string {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Prices stored in cents (payments/shipping) → display string. */
export function formatCents(cents: number | undefined, currency = 'USD'): string {
  return formatPrice((cents ?? 0) / 100, currency);
}

export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatDate(input?: string | Date): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Pick a localized product/category field with fallback:
 * requested locale → English → provided fallback.
 */
export function localizedText(
  localizations: Record<string, Record<string, string | undefined>> | undefined,
  locale: string,
  field: string,
  fallback?: string,
): string {
  return (
    localizations?.[locale]?.[field] ||
    localizations?.en?.[field] ||
    fallback ||
    ''
  );
}

export function truncate(str: string, max = 120): string {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max).trimEnd()}…` : str;
}

export function initials(name?: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Build a query string from a params object, skipping empty values. */
export function toQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, String(item)));
    else qs.append(k, String(v));
  }
  return qs.toString();
}
