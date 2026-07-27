import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Category } from '../products/schemas/product.schema';
import { RetrievalService, Hit } from './retrieval/retrieval.service';
import { FacetsService, Facet } from './retrieval/facets.service';
import { ResolvedFilters } from './retrieval/query-filters';
import { reciprocalRankFusion } from './retrieval/fusion';
import { QueryUnderstandingService, UnderstoodQuery } from './providers/query-understanding.service';
import { EmbeddingsService } from './providers/embeddings.service';
import { RerankService } from './providers/rerank.service';
import { SearchLogService } from './analytics/search-log.service';
import { CatalogSearchResult } from './dto/catalog-search.dto';

const CANDIDATE_SIZE = 100; // candidates pulled per retriever before fuse/rerank
const RERANK_TOP = 50; // how many fused candidates to send to the reranker

// Business re-rank weights (relevance dominates; signals nudge).
const W = { relevance: 1.0, rating: 0.15, sold: 0.15, featured: 0.1 };

export interface CatalogSearchParams {
  q?: string;
  locale: string;
  page: number;
  limit: number;
  filters: ResolvedFilters;
  sort?: string; // '' | relevance (default) | price_asc | price_desc | newest | rating | popular
}

export interface CatalogSearchResponse {
  data: CatalogSearchResult[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  facets: Facet[];
  query: {
    raw?: string;
    understood?: UnderstoodQuery | null;
    appliedFilters: ResolvedFilters;
  };
}

@Injectable()
export class CatalogSearchService {
  private readonly logger = new Logger(CatalogSearchService.name);
  private readonly locales: string[];
  private readonly defaultLocale: string;
  private readonly vectorEnabled: boolean;

  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    private readonly config: ConfigService,
    private readonly retrieval: RetrievalService,
    private readonly facets: FacetsService,
    private readonly qu: QueryUnderstandingService,
    private readonly embeddings: EmbeddingsService,
    private readonly rerank: RerankService,
    private readonly searchLog: SearchLogService,
  ) {
    this.locales = this.config.get<string[]>('search.locales') || ['en', 'so'];
    this.defaultLocale = this.config.get<string>('search.defaultLocale') || 'en';
    this.vectorEnabled = !!this.config.get<boolean>('search.flags.vector');
  }

  async search(params: CatalogSearchParams): Promise<CatalogSearchResponse> {
    const started = Date.now();
    const locale = this.locales.includes(params.locale) ? params.locale : this.defaultLocale;
    const { q, page, limit } = params;

    // 1) Query understanding (spellfix, filter parse, per-locale translation)
    const understood = q ? await this.qu.understand(q, this.locales) : null;
    const queries = understood?.queries ?? this.fallbackQueries(q);
    const filters = this.mergeFilters(params.filters, understood?.filters);

    // Resolve active category (for subtree filtering + dynamic facets)
    const category = filters.categorySlug
      ? await this.categoryModel.findOne({ slug: filters.categorySlug }).lean()
      : null;

    // 2) Parallel retrieval + facets (facets get the text query too, so they
    //    reflect the actual results — not the whole catalog).
    const cleaned = understood?.cleaned || q || '';
    // Embed the English (translated) query for the vector arm. English is the
    // highest-resource language for the embedder, and using it makes semantic
    // search CONSISTENT across query languages — a Somali/Turkish query and its
    // English equivalent embed to (nearly) the same vector → same results.
    // Falls back to the cleaned original when QU is off / produced no English.
    const vectorQuery = understood?.queries?.en || cleaned;
    const textShould = this.retrieval.buildTextShould(queries, locale);
    const [lexical, vectorHits, facets] = await Promise.all([
      this.retrieval.lexical(queries, filters, category, CANDIDATE_SIZE, locale),
      this.retrieveVector(vectorQuery, filters, category),
      this.facets.compute(filters, category, locale, textShould),
    ]);

    // 3) Merge sources + RRF fuse
    const byId = new Map<string, Hit>();
    for (const h of [...lexical.hits, ...vectorHits]) if (!byId.has(h.id)) byId.set(h.id, h);

    let order = reciprocalRankFusion([
      lexical.hits.map((h) => h.id),
      vectorHits.map((h) => h.id),
    ]);
    if (order.length === 0) order = lexical.hits.map((h) => h.id);

    // 4) Cross-encoder rerank (top slice only) — biggest precision lever
    order = await this.maybeRerank(cleaned, order, byId, locale);

    // 5) Ranking: explicit sort overrides relevance; otherwise business re-rank.
    order = params.sort
      ? this.applySort(order, byId, params.sort)
      : this.businessRerank(order, byId, understood?.filters?.gender);

    // 6) Paginate + hydrate from indexed _source (already localized)
    const total = Math.max(lexical.total, order.length);
    const start = (page - 1) * limit;
    const pageIds = order.slice(start, start + limit);
    const data = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((h) => this.toResult(h!.source, locale));

    const response: CatalogSearchResponse = {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
      facets,
      query: { raw: q, understood, appliedFilters: filters },
    };

    // Fire-and-forget analytics (never awaited, never throws into the request).
    this.searchLog.log({
      q: q || '',
      locale,
      resultCount: total,
      returned: data.length,
      tookMs: Date.now() - started,
      vectorUsed: vectorHits.length > 0,
      page,
      sort: params.sort,
      category: filters.categorySlug,
      brand: filters.brandSlug,
      hasFilters: !!(
        filters.categorySlug ||
        filters.brandSlug ||
        filters.priceMin != null ||
        filters.priceMax != null ||
        filters.rating != null ||
        (filters.attributes && filters.attributes.length)
      ),
      topResultIds: pageIds.slice(0, 10),
    });

    return response;
  }

  private async retrieveVector(
    cleaned: string,
    filters: ResolvedFilters,
    category: any,
  ): Promise<Hit[]> {
    if (!this.vectorEnabled || !this.embeddings.enabled || !cleaned.trim()) return [];
    const vec = await this.embeddings.embedQuery(cleaned);
    return this.retrieval.vector(vec, filters, category, CANDIDATE_SIZE);
  }

  private async maybeRerank(
    query: string,
    order: string[],
    byId: Map<string, Hit>,
    locale: string,
  ): Promise<string[]> {
    if (!this.rerank.enabled || !query.trim() || order.length === 0) return order;

    const slice = order.slice(0, RERANK_TOP);
    const docs = slice.map((id) => {
      const s = byId.get(id)?.source || {};
      return [
        s[`name_${locale}`] || s.name_en,
        s[`shortDescription_${locale}`] || s.shortDescription_en,
      ]
        .filter(Boolean)
        .join('. ');
    });

    const ranked = await this.rerank.rerank(query, docs, slice.length);
    if (!ranked) return order;

    const rerankedIds = ranked.map((r) => slice[r.index]);
    const tail = order.slice(RERANK_TOP);
    return [...rerankedIds, ...tail];
  }

  private applySort(order: string[], byId: Map<string, Hit>, sort: string): string[] {
    const src = (id: string) => byId.get(id)?.source || {};
    const cmp: Record<string, (a: any, b: any) => number> = {
      price_asc: (a, b) => (a.basePrice ?? 0) - (b.basePrice ?? 0),
      price_desc: (a, b) => (b.basePrice ?? 0) - (a.basePrice ?? 0),
      newest: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      rating: (a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0),
      popular: (a, b) => (b.totalSold ?? 0) - (a.totalSold ?? 0),
    };
    const fn = cmp[sort];
    if (!fn) return order;
    return [...order].sort((x, y) => fn(src(x), src(y)));
  }

  private businessRerank(order: string[], byId: Map<string, Hit>, queryGender?: string): string[] {
    const n = order.length || 1;
    const scored = order.map((id, idx) => {
      const s = byId.get(id)?.source || {};
      const relevance = (n - idx) / n; // rank → [0,1]
      const rating = (s.avgRating || 0) / 5;
      const sold = Math.log1p(s.totalSold || 0) / Math.log1p(1000); // saturating
      const featured = s.isFeatured ? 1 : 0;
      const score =
        W.relevance * relevance +
        W.rating * rating +
        W.sold * Math.min(sold, 1) +
        W.featured * featured +
        this.genderAdjust(queryGender, s);
      return { id, score };
    });
    return scored.sort((a, b) => b.score - a.score).map((x) => x.id);
  }

  /**
   * Gender-intent reranking. When the query targets an audience (e.g. "women's
   * shoes"), lift matching + unisex items and push the opposite adult gender down.
   * REORDER only — never a hard filter, so results are never zeroed out. Safe now
   * that normalization gives products near-complete `gender` attributes.
   */
  private genderAdjust(queryGender: string | undefined, s: Record<string, any>): number {
    if (!queryGender) return 0;
    const g = (s.attributes || []).find((a: any) => a?.key === 'gender')?.value;
    if (!g) return 0;
    if (g === queryGender) return 0.35;
    if (g === 'unisex') return 0.05;
    const opposite =
      (queryGender === 'women' && g === 'men') || (queryGender === 'men' && g === 'women');
    if (opposite) return -0.8;
    if (queryGender !== 'kids' && g === 'kids') return -0.4; // don't surface kids for adult queries
    return 0;
  }

  private toResult(s: Record<string, any>, locale: string): CatalogSearchResult {
    return {
      id: s.productId,
      slug: s.slug,
      name: s[`name_${locale}`] || s.name_en || '',
      shortDescription: s[`shortDescription_${locale}`] || s.shortDescription_en,
      price: s.basePrice,
      currency: s.currency,
      avgRating: s.avgRating ?? 0,
      totalSold: s.totalSold ?? 0,
      isFeatured: !!s.isFeatured,
      categoryId: s.categoryId,
      brandId: s.brandId,
      imageUrl: s.imageUrl,
    };
  }

  private fallbackQueries(q?: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const l of this.locales) out[l] = q || '';
    return out;
  }

  private mergeFilters(req: ResolvedFilters, understood?: UnderstoodQuery['filters']): ResolvedFilters {
    // Explicit request filters win over LLM-inferred ones. Price/category/brand
    // are safe to infer (structured, always-present fields). Attributes (e.g.
    // colour) are NOT applied as hard filters from QU — attribute coverage is
    // imperfect, so a hard filter could zero-out results. Only EXPLICIT attribute
    // filters (user clicked a facet) are enforced; the colour word still boosts
    // via the text query.
    return {
      categorySlug: req.categorySlug ?? understood?.categorySlug,
      brandSlug: req.brandSlug ?? understood?.brandSlug,
      priceMin: req.priceMin ?? understood?.priceMin,
      priceMax: req.priceMax ?? understood?.priceMax,
      rating: req.rating,
      attributes: req.attributes,
    };
  }
}
