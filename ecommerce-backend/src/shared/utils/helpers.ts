import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Generate a unique slug by appending random chars if needed
 */
export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = uuidv4().slice(0, 6);
  return `${base}-${suffix}`;
}

/**
 * Generate human-readable order number: ORD-20240115-A1B2
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = uuidv4().slice(0, 4).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

/**
 * Round to 2 decimal places (for money)
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
