import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from './http.util';

type InputType = 'search_document' | 'search_query';

// A live search query can't wait on a cold embedding model. Cap query embeds
// hard (→ graceful lexical fallback on timeout); allow indexing embeds to run long.
const QUERY_EMBED_TIMEOUT_MS = parseInt(process.env.SEARCH_QUERY_EMBED_TIMEOUT_MS || '6000', 10);
const DOC_EMBED_TIMEOUT_MS = parseInt(process.env.SEARCH_DOC_EMBED_TIMEOUT_MS || '30000', 10);

/**
 * Multilingual embeddings. Default provider: Cohere `embed-multilingual-v3`
 * (covers Somali). Swappable to OpenAI (plumbing only — weak on Somali) or
 * `none` (disables vector retrieval → lexical-only). Provider is chosen by
 * config, so changing it is a `.env` edit, not a code change.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(private readonly config: ConfigService) {}

  get provider(): string {
    return this.config.get<string>('search.embeddings.provider') || 'cohere';
  }

  get dims(): number {
    return this.config.get<number>('search.embeddings.dims') || 1024;
  }

  get enabled(): boolean {
    if (this.provider === 'cohere') {
      return !!this.config.get<string>('search.embeddings.cohere.apiKey');
    }
    if (this.provider === 'openai') {
      return !!this.config.get<string>('search.embeddings.openai.apiKey');
    }
    if (this.provider === 'openrouter') {
      return !!this.config.get<string>('search.embeddings.openrouter.apiKey');
    }
    return false;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts, 'search_document');
  }

  async embedQuery(text: string): Promise<number[] | null> {
    const [vec] = await this.embed([text], 'search_query');
    return vec ?? null;
  }

  private async embed(texts: string[], inputType: InputType): Promise<number[][]> {
    const clean = texts.map((t) => (t || '').trim()).filter(Boolean);
    if (!this.enabled || clean.length === 0) return [];
    const timeoutMs = inputType === 'search_query' ? QUERY_EMBED_TIMEOUT_MS : DOC_EMBED_TIMEOUT_MS;
    try {
      if (this.provider === 'cohere') return await this.cohere(clean, inputType, timeoutMs);
      if (this.provider === 'openai') return await this.openai(clean, timeoutMs);
      if (this.provider === 'openrouter') return await this.openrouter(clean, timeoutMs);
      return [];
    } catch (err) {
      this.logger.error(`Embedding failed (${this.provider}): ${(err as Error).message}`);
      return [];
    }
  }

  private async cohere(texts: string[], inputType: InputType, timeoutMs?: number): Promise<number[][]> {
    const apiKey = this.config.get<string>('search.embeddings.cohere.apiKey');
    const model = this.config.get<string>('search.embeddings.cohere.model');
    const res = await postJson<any>(
      'https://api.cohere.com/v2/embed',
      { model, texts, input_type: inputType, embedding_types: ['float'] },
      { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
    );
    // v2 → { embeddings: { float: number[][] } }; v1 → { embeddings: number[][] }
    return res?.embeddings?.float ?? res?.embeddings ?? [];
  }

  private async openai(texts: string[], timeoutMs?: number): Promise<number[][]> {
    const apiKey = this.config.get<string>('search.embeddings.openai.apiKey');
    const model = this.config.get<string>('search.embeddings.openai.model');
    const res = await postJson<any>(
      'https://api.openai.com/v1/embeddings',
      { model, input: texts },
      { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
    );
    return (res?.data ?? []).map((d: any) => d.embedding as number[]);
  }

  /**
   * OpenRouter (OpenAI-compatible). Qwen3-Embedding-8B returns 4096-dim vectors;
   * we slice to `dims` (Matryoshka) and L2-normalize so cosine == dot product,
   * matching the index mapping (cosinesimil) and the category vectors.
   */
  private async openrouter(texts: string[], timeoutMs?: number): Promise<number[][]> {
    const apiKey = this.config.get<string>('search.embeddings.openrouter.apiKey');
    const baseUrl =
      this.config.get<string>('search.embeddings.openrouter.baseUrl') || 'https://openrouter.ai/api/v1';
    const model = this.config.get<string>('search.embeddings.openrouter.model');
    const res = await postJson<any>(
      `${baseUrl}/embeddings`,
      { model, input: texts },
      { Authorization: `Bearer ${apiKey}` },
      timeoutMs,
    );
    const dims = this.dims;
    return (res?.data ?? []).map((d: any) => normalize((d.embedding as number[]).slice(0, dims)));
  }
}

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}
