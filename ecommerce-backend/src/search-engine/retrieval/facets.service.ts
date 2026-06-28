import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from '../opensearch/opensearch.constants';
import { buildOpenSearchFilters, ResolvedFilters } from './query-filters';
import { CategoryFacet } from '../../products/schemas/product.schema';

export interface FacetOption {
  value: string;
  count: number;
}
export interface Facet {
  key: string;
  type: 'terms' | 'range' | 'color';
  label: string;
  options?: FacetOption[];
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * Search-aware faceted filters. Global facets (brand, price, rating) are always
 * computed; dynamic attribute facets are driven by the active category's
 * `facets` config — so searching "phones" yields storage/RAM/colour while
 * "shoes" yields size/colour, all from the same nested attribute aggregations.
 */
@Injectable()
export class FacetsService {
  private readonly logger = new Logger(FacetsService.name);

  constructor(
    @Inject(OPENSEARCH_CLIENT) private readonly client: Client,
    private readonly config: ConfigService,
  ) {}

  private get index(): string {
    return this.config.get<string>('search.opensearch.productIndex') || 'products_v1';
  }

  async compute(
    filters: ResolvedFilters,
    category: { _id?: any; facets?: CategoryFacet[] } | null,
    locale: string,
  ): Promise<Facet[]> {
    const filter = buildOpenSearchFilters(filters, category);
    const aggs = this.buildAggs(category);
    try {
      const res = await this.client.search({
        index: this.index,
        body: { size: 0, query: { bool: { filter } }, aggs },
      });
      return this.parse((res.body as any).aggregations, category, locale);
    } catch (err) {
      this.logger.error(`Facet aggregation failed: ${(err as Error).message}`);
      return [];
    }
  }

  private buildAggs(category: { facets?: CategoryFacet[] } | null): Record<string, any> {
    const aggs: Record<string, any> = {
      brands: { terms: { field: 'brandSlug', size: 20 } },
      price: { stats: { field: 'basePrice' } },
      ratings: { range: { field: 'avgRating', ranges: [{ from: 4 }, { from: 3 }, { from: 2 }] } },
    };

    for (const facet of category?.facets || []) {
      const inner =
        facet.type === 'range'
          ? { stats: { stats: { field: 'attributes.valueNum' } } }
          : { values: { terms: { field: 'attributes.value', size: 40 } } };
      aggs[`attr_${facet.attributeKey}`] = {
        nested: { path: 'attributes' },
        aggs: {
          f: {
            filter: { term: { 'attributes.key': facet.attributeKey } },
            aggs: inner,
          },
        },
      };
    }
    return aggs;
  }

  private parse(
    aggs: any,
    category: { facets?: CategoryFacet[] } | null,
    locale: string,
  ): Facet[] {
    const out: Facet[] = [];
    if (!aggs) return out;

    if (aggs.brands?.buckets?.length) {
      out.push({
        key: 'brand',
        type: 'terms',
        label: 'Brand',
        options: aggs.brands.buckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
      });
    }

    if (aggs.price && aggs.price.count > 0) {
      out.push({ key: 'price', type: 'range', label: 'Price', min: aggs.price.min, max: aggs.price.max });
    }

    if (aggs.ratings?.buckets) {
      const opts = aggs.ratings.buckets
        .filter((b: any) => b.doc_count > 0)
        .map((b: any) => ({ value: `${b.from}+`, count: b.doc_count }));
      if (opts.length) out.push({ key: 'rating', type: 'terms', label: 'Rating', options: opts });
    }

    const facetConfigs = [...(category?.facets || [])].sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99),
    );
    for (const facet of facetConfigs) {
      const node = aggs[`attr_${facet.attributeKey}`]?.f;
      if (!node) continue;
      const label = facet.label?.[locale] || facet.label?.en || facet.attributeKey;
      if (facet.type === 'range') {
        const s = node.stats;
        if (s && s.count > 0) {
          out.push({ key: facet.attributeKey, type: 'range', label, min: s.min, max: s.max, unit: facet.unit });
        }
      } else {
        const buckets = node.values?.buckets || [];
        if (buckets.length) {
          out.push({
            key: facet.attributeKey,
            type: facet.type,
            label,
            options: buckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
          });
        }
      }
    }
    return out;
  }
}
