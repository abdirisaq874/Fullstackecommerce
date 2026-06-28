import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from './http.util';

export interface UnderstoodQuery {
  /** Cleaned, spell-corrected query in the user's language. */
  cleaned: string;
  /** Per-locale query strings for lexical search across stored locales. */
  queries: Record<string, string>;
  /** Detected language code (e.g. "en" | "so"). */
  language: string;
  /** Structured filters extracted from natural language. */
  filters: {
    categorySlug?: string;
    brandSlug?: string;
    priceMin?: number;
    priceMax?: number;
    attributes?: { key: string; value: string }[];
  };
  intent: 'search' | 'question' | 'navigational';
}

/**
 * LLM query understanding via OpenRouter (Gemini): spell correction, dialect /
 * synonym expansion, structured filter extraction, and per-locale query
 * translation. Returns null on failure so the pipeline falls back to using the
 * raw query for all locales.
 */
@Injectable()
export class QueryUnderstandingService {
  private readonly logger = new Logger(QueryUnderstandingService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return (
      !!this.config.get<boolean>('search.flags.queryUnderstanding') &&
      !!this.config.get<string>('search.openrouter.apiKey')
    );
  }

  async understand(raw: string, locales: string[]): Promise<UnderstoodQuery | null> {
    if (!this.enabled || !raw?.trim()) return null;
    const apiKey = this.config.get<string>('search.openrouter.apiKey');
    const baseUrl = this.config.get<string>('search.openrouter.baseUrl');
    const model = this.config.get<string>('search.openrouter.queryUnderstandingModel');

    const system =
      `You are a multilingual e-commerce search query-understanding engine for ` +
      `English (en) and Somali (so). Given a raw search query, return STRICT JSON ` +
      `with this exact shape:\n` +
      `{"cleaned": string, "queries": {${locales.map((l) => `"${l}": string`).join(', ')}}, ` +
      `"language": "en"|"so", "filters": {"categorySlug"?: string, "brandSlug"?: string, ` +
      `"priceMin"?: number, "priceMax"?: number, "attributes"?: [{"key": string, "value": string}]}, ` +
      `"intent": "search"|"question"|"navigational"}\n` +
      `Rules: fix spelling; expand Somali dialect/loanword variants; translate the ` +
      `query into every listed locale; extract price ranges (e.g. "ka hooseeya 50 dollar" ` +
      `=> priceMax 50) and obvious attributes (color/size/storage). Return ONLY the JSON.`;

    try {
      const res = await postJson<any>(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: raw },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        },
        { Authorization: `Bearer ${apiKey}` },
      );
      const content = res?.choices?.[0]?.message?.content;
      if (!content) return null;
      return this.normalize(JSON.parse(content), raw, locales);
    } catch (err) {
      this.logger.warn(`Query understanding failed: ${(err as Error).message}`);
      return null;
    }
  }

  private normalize(parsed: any, raw: string, locales: string[]): UnderstoodQuery {
    const queries: Record<string, string> = {};
    for (const l of locales) {
      queries[l] = (parsed?.queries?.[l] || parsed?.cleaned || raw).toString();
    }
    return {
      cleaned: (parsed?.cleaned || raw).toString(),
      queries,
      language: parsed?.language || locales[0],
      filters: {
        categorySlug: parsed?.filters?.categorySlug,
        brandSlug: parsed?.filters?.brandSlug,
        priceMin: numOrUndef(parsed?.filters?.priceMin),
        priceMax: numOrUndef(parsed?.filters?.priceMax),
        attributes: Array.isArray(parsed?.filters?.attributes)
          ? parsed.filters.attributes
              .filter((a: any) => a?.key && a?.value)
              .map((a: any) => ({ key: String(a.key), value: String(a.value) }))
          : undefined,
      },
      intent: ['search', 'question', 'navigational'].includes(parsed?.intent)
        ? parsed.intent
        : 'search',
    };
  }
}

function numOrUndef(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
