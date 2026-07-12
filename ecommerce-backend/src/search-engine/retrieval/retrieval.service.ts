import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from '../opensearch/opensearch.constants';
import { buildOpenSearchFilters, ResolvedFilters } from './query-filters';

export interface Hit {
  id: string;
  score: number;
  source: Record<string, any>;
}

/**
 * The only engine-coupled service. Runs the two retrievers — lexical (BM25 with
 * per-locale analyzers + fuzziness) and dense vector (k-NN) — against OpenSearch.
 * Swapping to Elasticsearch later means changing only this file + the index def.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(OPENSEARCH_CLIENT) private readonly client: Client,
    private readonly config: ConfigService,
  ) {}

  private get index(): string {
    return this.config.get<string>('search.opensearch.productIndex') || 'products_v1';
  }

  /**
   * Build the per-locale text `should` clauses (multi_match + phrase-prefix).
   * Shared by lexical retrieval AND facet aggregation so facets reflect the
   * actual search query, not just the structural filters.
   */
  buildTextShould(queries: Record<string, string>, locale: string): any[] {
    const should: any[] = [];
    for (const [loc, qstr] of Object.entries(queries)) {
      if (!qstr?.trim()) continue;
      const localeBoost = loc === locale ? 2 : 1;
      should.push({
        multi_match: {
          query: qstr,
          type: 'best_fields',
          fuzziness: 'AUTO',
          // Require the first 2 chars to match before fuzzing — stops wild
          // cross-word matches like "speaker"→"sweater"/"Bone Shaker".
          prefix_length: 2,
          // Multi-word queries must match most of their terms, not just one —
          // otherwise a lone common word (esp. un-stopped English words in the
          // Somali-fallback fields) matches nearly the whole catalog.
          minimum_should_match: '2<70%',
          fields: [`name_${loc}^${3 * localeBoost}`, `shortDescription_${loc}^2`, `description_${loc}`],
        },
      });
      should.push({ match_phrase_prefix: { [`name_${loc}`]: { query: qstr, boost: 2 * localeBoost } } });
    }
    return should;
  }

  /** Lexical BM25 across all stored locales; current locale boosted. */
  async lexical(
    queries: Record<string, string>,
    filters: ResolvedFilters,
    category: { _id?: any } | null,
    size: number,
    locale: string,
  ): Promise<{ total: number; hits: Hit[] }> {
    const filter = buildOpenSearchFilters(filters, category);
    const should = this.buildTextShould(queries, locale);
    const hasText = should.length > 0;
    const query = hasText
      ? { bool: { should, minimum_should_match: 1, filter } }
      : { bool: { filter } };

    try {
      const res = await this.client.search({
        index: this.index,
        body: { size, query, _source: { excludes: ['embedding'] } },
      });
      const body: any = res.body;
      return {
        total: body.hits?.total?.value ?? body.hits?.hits?.length ?? 0,
        hits: this.mapHits(body),
      };
    } catch (err) {
      this.logger.error(`Lexical search failed: ${(err as Error).message}`);
      return { total: 0, hits: [] };
    }
  }

  /** Dense k-NN retrieval with the same filter context. */
  async vector(
    vector: number[] | null,
    filters: ResolvedFilters,
    category: { _id?: any } | null,
    size: number,
  ): Promise<Hit[]> {
    if (!vector || vector.length === 0) return [];
    const filter = buildOpenSearchFilters(filters, category);
    // Only keep genuinely-close neighbours — below this, k-NN just returns the
    // nearest-of-everything and floods the result set.
    const minScore = this.config.get<number>('search.vectorMinScore') ?? 0.85;
    try {
      const res = await this.client.search({
        index: this.index,
        body: {
          size,
          min_score: minScore,
          query: { knn: { embedding: { vector, k: size, filter: { bool: { filter } } } } },
          _source: { excludes: ['embedding'] },
        },
      });
      return this.mapHits(res.body as any);
    } catch (err) {
      this.logger.error(`Vector search failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Nearest neighbours to a product's own vector — "related / similar products".
   * Unlike `vector()` there is NO min-score gate: we always want the top-K most
   * similar active products (excluding the product itself).
   */
  async similar(vector: number[], size: number, excludeProductId: string): Promise<Hit[]> {
    if (!vector || vector.length === 0) return [];
    try {
      const res = await this.client.search({
        index: this.index,
        body: {
          size,
          query: {
            knn: {
              embedding: {
                vector,
                k: size + 1,
                filter: {
                  bool: {
                    must_not: [{ ids: { values: [excludeProductId] } }],
                    filter: [{ term: { status: 'active' } }],
                  },
                },
              },
            },
          },
          _source: { excludes: ['embedding'] },
        },
      });
      return this.mapHits(res.body as any).filter((h) => h.id !== excludeProductId).slice(0, size);
    } catch (err) {
      this.logger.error(`Similar search failed: ${(err as Error).message}`);
      return [];
    }
  }

  private mapHits(body: any): Hit[] {
    return (body?.hits?.hits ?? []).map((h: any) => ({
      id: h._id,
      score: h._score ?? 0,
      source: h._source ?? {},
    }));
  }
}
