import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from './http.util';

export interface RerankResult {
  index: number; // index into the input documents array
  score: number; // relevance score (higher = better)
}

/**
 * Cross-encoder reranker — the biggest single relevance lever. Default: Cohere
 * Rerank (multilingual, covers Somali). Returns null on failure/disabled so the
 * pipeline falls back to the fused order.
 */
@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return (
      !!this.config.get<boolean>('search.flags.rerank') &&
      this.config.get<string>('search.rerank.provider') === 'cohere' &&
      !!this.config.get<string>('search.rerank.cohere.apiKey')
    );
  }

  async rerank(
    query: string,
    documents: string[],
    topN: number,
  ): Promise<RerankResult[] | null> {
    if (!this.enabled || !query?.trim() || documents.length === 0) return null;
    const apiKey = this.config.get<string>('search.rerank.cohere.apiKey');
    const model = this.config.get<string>('search.rerank.cohere.model');
    try {
      const res = await postJson<any>(
        'https://api.cohere.com/v2/rerank',
        { model, query, documents, top_n: Math.min(topN, documents.length) },
        { Authorization: `Bearer ${apiKey}` },
      );
      return (res?.results ?? []).map((r: any) => ({
        index: r.index,
        score: r.relevance_score,
      }));
    } catch (err) {
      this.logger.warn(`Rerank failed: ${(err as Error).message}`);
      return null;
    }
  }
}
