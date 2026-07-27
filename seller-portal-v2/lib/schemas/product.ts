/**
 * Product form schema (D1).
 *
 * Mirrors the fields rendered by `components/product/product-form.tsx` and the
 * `CreateProductDto` shape consumed by `lib/api/products-api.ts`. Stays a thin
 * mapping over the existing `Product*` types so the DTO builder in
 * `lib/utils/index.ts` can keep its current shape.
 *
 * Notes:
 *  - Prices in the form are user-typed strings (number inputs return strings).
 *    We accept strings here and convert to numbers in the DTO builder.
 *  - Variants render even before all fields are filled, so most variant fields
 *    are permissive — final validation happens in the cross-form `superRefine`.
 *  - Localizations are an object keyed by locale (en / tr / so / sw / am)
 *    matching the existing `LocalizedFields` type so we don't break the API.
 */
import { z } from 'zod';

// --- enums / shared --------------------------------------------------------

export const productStatusSchema = z.enum(['draft', 'active', 'archived']);
export type ProductFormStatus = z.infer<typeof productStatusSchema>;

export const localeCodeSchema = z.enum(['en', 'tr', 'so', 'sw', 'am']);
export type ProductLocaleCode = z.infer<typeof localeCodeSchema>;

// A price that comes from a number input. Empty string = "not provided".
const priceString = z
  .string()
  .trim()
  .refine((v) => v === '' || !Number.isNaN(Number(v)), 'Must be a number')
  .refine((v) => v === '' || Number(v) >= 0, 'Must be ≥ 0');

const requiredPriceString = z
  .string()
  .trim()
  .min(1, 'Base price is required')
  .refine((v) => !Number.isNaN(Number(v)), 'Must be a number')
  .refine((v) => Number(v) >= 0, 'Must be ≥ 0');

// --- nested shapes ---------------------------------------------------------

export const productOptionSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const productDimensionSchema = z.object({
  name: z.string().min(1, 'Dimension name required'),
  values: z.array(z.string().min(1)).min(1, 'Add at least one value'),
});

export const productVariantSchema = z.object({
  sku: z.string().min(1, 'SKU required'),
  name: z.string().optional(),
  stockOnHand: z.union([z.number(), z.string()]).optional(),
  priceOverride: z.union([z.number(), z.string()]).optional(),
  costPrice: z.union([z.number(), z.string()]).optional(),
  weightGrams: z.union([z.number(), z.string()]).optional(),
  barcode: z.string().optional(),
  options: z.array(productOptionSchema).optional(),
});

export const productImageSchema = z.object({
  url: z.string().min(1, 'Image URL required'),
  altText: z.string().optional(),
  // Structured variant-image association (dimension-agnostic: color/material/…).
  // Image shows for variants whose options include every {name,value} here;
  // empty/absent = shared across all variants.
  appliesTo: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const productAttributeSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const localizedFieldSchema = z
  .object({
    name: z.string().optional(),
    shortDescription: z.string().max(500, 'Max 500 characters').optional(),
    description: z.string().optional(),
  })
  .optional();

export const localizedFieldsSchema = z.object({
  en: localizedFieldSchema,
  tr: localizedFieldSchema,
  so: localizedFieldSchema,
  sw: localizedFieldSchema,
  am: localizedFieldSchema,
});

// --- root schema -----------------------------------------------------------

export const productFormSchema = z
  .object({
    // basics
    name: z.string().trim().min(1, 'Name is required'),
    categoryId: z.string().optional().default(''),
    brandId: z.string().optional().default(''),
    shortDescription: z.string().max(500, 'Max 500 characters').optional().default(''),
    description: z.string().optional().default(''),
    // AI-generated, system-managed discovery signals.
    tags: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    status: productStatusSchema.default('draft'),
    isFeatured: z.boolean().default(false),
    // Seller-supplied (override AI). 'auto' = let AI infer from the product.
    gender: z.enum(['auto', 'men', 'women', 'unisex']).default('auto'),
    ageGroup: z.enum(['auto', 'adult', 'kids']).default('auto'),
    gtin: z.string().trim().optional().default(''),
    // Seller-supplied (not AI-inferable): item condition + package size for shipping.
    condition: z.enum(['new', 'used', 'refurbished']).default('new'),
    packageDimensionsCm: z
      .object({
        length: z.string().optional().default(''),
        width: z.string().optional().default(''),
        height: z.string().optional().default(''),
      })
      .default({ length: '', width: '', height: '' }),

    // pricing
    basePrice: requiredPriceString,
    compareAtPrice: priceString.default(''),
    currency: z.string().min(1, 'Currency is required').default('USD'),

    // variants
    hasVariants: z.boolean().default(false),
    stockOnHand: z.string().default(''),
    dimensions: z.array(productDimensionSchema).default([]),
    variants: z.array(productVariantSchema).default([]),

    // images
    images: z.array(productImageSchema).default([]),

    // SEO + attributes
    metaTitle: z.string().max(60, 'Max 60 characters').optional().default(''),
    metaDescription: z.string().max(160, 'Max 160 characters').optional().default(''),
    attributes: z.array(productAttributeSchema).default([]),

    // multi-language fields (EN/TR/SO/SW/AM)
    localizations: localizedFieldsSchema.default({ en: {} }),
  })
  .superRefine((data, ctx) => {
    // Compare-at is the struck-through "was" price — it only makes sense when it's
    // higher than the base price the buyer actually pays, otherwise the storefront
    // renders a backwards "discount". Checked for all products (before the
    // variants-only early return below).
    if (data.compareAtPrice !== '' && data.basePrice !== '') {
      const compareAt = Number(data.compareAtPrice);
      const base = Number(data.basePrice);
      if (!Number.isNaN(compareAt) && !Number.isNaN(base) && compareAt <= base) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compareAtPrice'],
          message: 'Compare-at price must be higher than the base price',
        });
      }
    }

    // Cross-field rule: when hasVariants is on, require dimensions + SKUs.
    if (!data.hasVariants) return;

    if (data.dimensions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dimensions'],
        message: 'Add at least one dimension (e.g. Size)',
      });
    } else {
      const seen = new Set<string>();
      data.dimensions.forEach((d, i) => {
        const lower = d.name.toLowerCase();
        if (seen.has(lower)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dimensions', i, 'name'],
            message: 'Duplicate dimension',
          });
        }
        seen.add(lower);
      });
    }

    if (data.variants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'No variants generated — check your dimensions',
      });
    } else {
      const skus = new Set<string>();
      data.variants.forEach((v, i) => {
        if (skus.has(v.sku)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['variants', i, 'sku'],
            message: 'Duplicate SKU',
          });
        }
        skus.add(v.sku);
      });
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
