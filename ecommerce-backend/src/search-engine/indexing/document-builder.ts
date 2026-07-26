import { ProductLocale } from '../../products/schemas/product.schema';
import { extractColors } from './color-extractor';

type AnyDoc = Record<string, any>;

/** Resolve a localized field with fallback: requested locale → base → legacy flat field. */
export function localizedField(
  product: AnyDoc,
  locale: string,
  field: keyof ProductLocale,
  baseLocale = 'en',
): string {
  return (
    product?.localizations?.[locale]?.[field] ||
    product?.localizations?.[baseLocale]?.[field] ||
    product?.[field] ||
    ''
  );
}

function toNum(v: any): number | undefined {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Map a Mongo product (+ its category & brand) to the OpenSearch document shape.
 * Pure function — no I/O — so it's trivially testable.
 */
export function buildProductDoc(
  product: AnyDoc,
  refs: { category?: AnyDoc | null; brand?: AnyDoc | null },
  locales: string[],
  baseLocale = 'en',
): AnyDoc {
  const doc: AnyDoc = {
    productId: String(product._id),
    slug: product.slug,
    sellerId: product.sellerId ? String(product.sellerId) : undefined,
    status: product.status,
    isFeatured: !!product.isFeatured,
    inStock: product.inStock !== undefined ? !!product.inStock : true,

    categoryId: product.categoryId ? String(product.categoryId) : undefined,
    categorySlug: refs.category?.slug,
    categoryAncestors: [
      ...(refs.category?.ancestors || []).map((a: any) => String(a)),
      ...(refs.category?._id ? [String(refs.category._id)] : []),
    ],
    brandId: product.brandId ? String(product.brandId) : undefined,
    brandSlug: refs.brand?.slug,
    imageUrl: (product.images?.find((i: any) => i.isPrimary) ?? product.images?.[0])?.url,

    basePrice: product.basePrice,
    currency: product.currency,
    avgRating: product.avgRating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    totalSold: product.totalSold ?? 0,
    popularity: product.searchSignals?.popularity ?? product.totalSold ?? 0,
    salesVelocity: product.searchSignals?.salesVelocity ?? 0,
    createdAt: product.createdAt,

    attributes: (product.attributes || []).map((a: any) => ({
      key: a.key,
      value: a.value,
      valueNum: toNum(a.value),
    })),
  };

  for (const locale of locales) {
    doc[`name_${locale}`] = localizedField(product, locale, 'name', baseLocale);
    doc[`shortDescription_${locale}`] = localizedField(product, locale, 'shortDescription', baseLocale);
    doc[`description_${locale}`] = localizedField(product, locale, 'description', baseLocale);
  }

  // Derive `color` attributes from the (multilingual) name + short description so
  // colour becomes a facet + filter even when the seller didn't tag it. Skips any
  // colour already present in the product's own attributes.
  const existingColors = new Set(
    doc.attributes
      .filter((a: AnyDoc) => ['color', 'colour', 'renk'].includes(String(a.key).toLowerCase()))
      .map((a: AnyDoc) => String(a.value).toLowerCase()),
  );
  const colorText = [
    ...locales.map((l) => doc[`name_${l}`]),
    ...locales.map((l) => doc[`shortDescription_${l}`]),
  ];
  for (const c of extractColors(colorText)) {
    if (!existingColors.has(c)) {
      doc.attributes.push({ key: 'color', value: c, valueNum: undefined });
      existingColors.add(c);
    }
  }

  if (Array.isArray(product.embedding) && product.embedding.length > 0) {
    doc.embedding = product.embedding;
  }

  return doc;
}
