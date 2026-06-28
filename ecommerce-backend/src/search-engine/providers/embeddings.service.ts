import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from './http.util';

type InputType = 'search_document' | 'search_query';

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
    try {
      if (this.provider === 'cohere') return await this.cohere(clean, inputType);
      if (this.provider === 'openai') return await this.openai(clean);
      return [];
    } catch (err) {
      this.logger.error(`Embedding failed (${this.provider}): ${(err as Error).message}`);
      return [];
    }
  }

  private async cohere(texts: string[], inputType: InputType): Promise<number[][]> {
    const apiKey = this.config.get<string>('search.embeddings.cohere.apiKey');
    const model = this.config.get<string>('search.embeddings.cohere.model');
    const res = await postJson<any>(
      'https://api.cohere.com/v2/embed',
      { model, texts, input_type: inputType, embedding_types: ['float'] },
      { Authorization: `Bearer ${apiKey}` },
    );
    // v2 → { embeddings: { float: number[][] } }; v1 → { embeddings: number[][] }
    return res?.embeddings?.float ?? res?.embeddings ?? [];
  }

  private async openai(texts: string[]): Promise<number[][]> {
    const apiKey = this.config.get<string>('search.embeddings.openai.apiKey');
    const model = this.config.get<string>('search.embeddings.openai.model');
    const res = await postJson<any>(
      'https://api.openai.com/v1/embeddings',
      { model, input: texts },
      { Authorization: `Bearer ${apiKey}` },
    );
    return (res?.data ?? []).map((d: any) => d.embedding as number[]);
  }
}
