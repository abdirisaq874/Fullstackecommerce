import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from '../search-engine/providers/http.util';

export interface NormalizedProduct {
  sourceLang: string;
  name: string;
  shortDescription?: string;
  description?: string;
  gender?: string | null;
  attributes: { key: string; value: string }[];
}

export interface RawProduct {
  name?: string;
  shortDescription?: string;
  description?: string;
  attributes?: { key: string; value: string }[];
}

const TIMEOUT_MS = parseInt(process.env.NORMALIZE_TIMEOUT_MS || '25000', 10);

const SYSTEM =
  "You normalize e-commerce product data. The store's canonical language is ENGLISH. " +
  'Given a raw product (often Turkish), return STRICT JSON only:\n' +
  '{"sourceLang":"tr|en|..","name":"clean concise English title",' +
  '"shortDescription":"one-sentence English description",' +
  '"gender":"men|women|unisex|kids|null",' +
  '"attributes":[{"key":"canonical_snake_case_english","value":"normalized english value"}]}\n' +
  'Rules:\n' +
  '- Translate Turkish->English. KEEP brand names, model numbers and SKUs EXACTLY (never translate identifiers).\n' +
  '- Normalize attribute KEYS to canonical English snake_case (Renk->color, Materyal->material, ' +
  'Desen->pattern, Topuk Tipi->heel_type, Menşei->origin_country, Beden->size, Cinsiyet->gender, ' +
  'Bağlama Şekli->closure_type, Kumaş Tipi->fabric_type).\n' +
  '- Normalize attribute VALUES to lowercase English (Siyah->black, Beyaz->white, Kadın->women, Erkek->men, Deri->leather).\n' +
  '- Always include color/gender/material attributes when inferable from the name, even if absent.\n' +
  '- Only include attributes you are confident about; do not invent specs.\n' +
  '- Output ONLY the JSON.';

/**
 * Turns a raw (often Turkish) product into English-canonical text + a normalized,
 * English attribute schema in ONE LLM call (gemini-2.5-flash on OpenRouter).
 * The write-back (into localizations.en / attributes, preserving the original) is
 * done by the caller so this stays a pure transformer.
 */
@Injectable()
export class ProductNormalizationService {
  private readonly logger = new Logger(ProductNormalizationService.name);
  readonly model = process.env.OPENROUTER_NORMALIZE_MODEL || 'google/gemini-2.5-flash';

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('search.openrouter.apiKey');
  }

  async normalize(raw: RawProduct): Promise<NormalizedProduct | null> {
    if (!this.enabled || !raw?.name?.trim()) return null;
    const apiKey = this.config.get<string>('search.openrouter.apiKey');
    const baseUrl =
      this.config.get<string>('search.openrouter.baseUrl') || 'https://openrouter.ai/api/v1';
    const payloadRaw = {
      name: raw.name,
      description: raw.shortDescription || raw.description || undefined,
      attributes: (raw.attributes || []).slice(0, 25),
    };
    try {
      const res = await postJson<any>(
        `${baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify(payloadRaw) },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        },
        { Authorization: `Bearer ${apiKey}` },
        TIMEOUT_MS,
      );
      const content = res?.choices?.[0]?.message?.content;
      if (!content) return null;
      return this.clean(JSON.parse(content));
    } catch (err) {
      this.logger.warn(`normalize failed: ${(err as Error).message}`);
      return null;
    }
  }

  private clean(p: any): NormalizedProduct | null {
    if (!p?.name || typeof p.name !== 'string') return null;
    const attrs = Array.isArray(p.attributes)
      ? p.attributes
          .filter((a: any) => a?.key && a?.value)
          .map((a: any) => ({
            key: String(a.key).trim().toLowerCase().replace(/\s+/g, '_'),
            value: String(a.value).trim().toLowerCase(),
          }))
      : [];
    const gender =
      p.gender && ['men', 'women', 'unisex', 'kids'].includes(String(p.gender)) ? String(p.gender) : null;
    if (gender && !attrs.find((a: { key: string }) => a.key === 'gender'))
      attrs.push({ key: 'gender', value: gender });
    return {
      sourceLang: (p.sourceLang || 'tr').toString().slice(0, 5),
      name: p.name.trim(),
      shortDescription: p.shortDescription ? String(p.shortDescription).trim() : undefined,
      description: p.description ? String(p.description).trim() : undefined,
      gender,
      attributes: attrs,
    };
  }
}
