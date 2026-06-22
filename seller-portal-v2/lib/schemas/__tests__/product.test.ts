/**
 * H7 example test — productFormSchema.
 *
 * Verifies the schema in `lib/schemas/product.ts`:
 *  1. accepts a minimal valid payload (with the form defaults filled in).
 *  2. rejects a missing/empty `name`.
 *  3. rejects a negative `basePrice` (the on-wire equivalent of basePriceCents).
 */
import { describe, it, expect } from 'vitest';
import { productFormSchema } from '../product';

describe('productFormSchema', () => {
  it('accepts a valid payload', () => {
    const result = productFormSchema.safeParse({
      name: 'Forest Green Sneakers',
      basePrice: '49.99',
      currency: 'USD',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Forest Green Sneakers');
      expect(result.data.basePrice).toBe('49.99');
      // Defaults are filled in by zod.
      expect(result.data.status).toBe('draft');
      expect(result.data.hasVariants).toBe(false);
    }
  });

  it('rejects a missing name', () => {
    const result = productFormSchema.safeParse({
      name: '',
      basePrice: '10.00',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) =>
        i.path.includes('name'),
      );
      expect(nameIssue?.message).toBe('Name is required');
    }
  });

  it('rejects a negative base price', () => {
    const result = productFormSchema.safeParse({
      name: 'Bad Pricing Product',
      basePrice: '-5',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const priceIssue = result.error.issues.find((i) =>
        i.path.includes('basePrice'),
      );
      expect(priceIssue?.message).toBe('Must be ≥ 0');
    }
  });
});
