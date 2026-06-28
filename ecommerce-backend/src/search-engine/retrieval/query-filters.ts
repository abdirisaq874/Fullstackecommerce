export interface ResolvedFilters {
  categorySlug?: string;
  brandSlug?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  attributes?: { key: string; value: string }[];
}

/**
 * Translate resolved filters into an OpenSearch filter-context clause array.
 * Shared by retrieval (results) and facets (aggregations) so they stay in sync.
 *
 * Category subtree: `categoryAncestors` on each product holds its full ancestor
 * chain *plus its own category id*, so a single term on the category's _id
 * matches the category and every descendant.
 */
export function buildOpenSearchFilters(
  filters: ResolvedFilters,
  category?: { _id?: any } | null,
): any[] {
  const clauses: any[] = [{ term: { status: 'active' } }];

  if (category?._id) {
    clauses.push({ term: { categoryAncestors: String(category._id) } });
  } else if (filters.categorySlug) {
    clauses.push({ term: { categorySlug: filters.categorySlug } });
  }

  if (filters.brandSlug) {
    clauses.push({ term: { brandSlug: filters.brandSlug } });
  }

  if (filters.priceMin != null || filters.priceMax != null) {
    const range: Record<string, number> = {};
    if (filters.priceMin != null) range.gte = filters.priceMin;
    if (filters.priceMax != null) range.lte = filters.priceMax;
    clauses.push({ range: { basePrice: range } });
  }

  if (filters.rating != null) {
    clauses.push({ range: { avgRating: { gte: filters.rating } } });
  }

  for (const attr of filters.attributes || []) {
    clauses.push({
      nested: {
        path: 'attributes',
        query: {
          bool: {
            filter: [
              { term: { 'attributes.key': attr.key } },
              { term: { 'attributes.value': attr.value } },
            ],
          },
        },
      },
    });
  }

  return clauses;
}
