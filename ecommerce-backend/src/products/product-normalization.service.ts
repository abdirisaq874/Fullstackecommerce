import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from '../search-engine/providers/http.util';

export interface NormalizedProduct {
  sourceLang: string;
  name: string;
  shortDescription?: string;
  description?: string;
  gender?: string | null;
  ageGroup?: string | null;
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
  '"ageGroup":"adult|kids|null",' +
  '"attributes":[{"key":"canonical_snake_case_english","value":"normalized english value"}]}\n' +
  'Rules:\n' +
  '- Translate Turkish->English by MEANING. KEEP brand names, model numbers and SKUs EXACTLY (never translate identifiers).\n' +
  '- NEVER transliterate or romanize Turkish letters (ü ş ı ğ ö ç). Do NOT produce phonetic ASCII like ' +
  '"Yueruues" or "Guenluek". Translate the whole word: Yürüyüş->Walking/Hiking, Günlük->Casual/Daily, ' +
  'Ayakkabı->Shoe, Erkek->Men, Kadın->Women, Terlik->Slipper, Bot->Boot, Çanta->Bag, Kışlık->Winter. ' +
  'If a real word truly cannot be translated, keep its ORIGINAL Turkish spelling WITH diacritics — never an ASCII approximation.\n' +
  '- Normalize attribute KEYS to canonical English snake_case (Renk->color, Materyal->material, ' +
  'Desen->pattern, Topuk Tipi->heel_type, Menşei->origin_country, Beden->size, Cinsiyet->gender, ' +
  'Bağlama Şekli->closure_type, Kumaş Tipi->fabric_type).\n' +
  '- Normalize attribute VALUES to lowercase English (Siyah->black, Beyaz->white, Kadın->women, Erkek->men, Deri->leather).\n' +
  '- Always include color, gender, age_group and material attributes when inferable from the name, even if absent ' +
  '(age_group: adult unless the item is clearly for children/babies → kids).\n' +
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

  /**
   * Apply a NormalizedProduct onto a product-like target (a create DTO or a Mongoose
   * doc), English-canonicalizing it while preserving the original in localizations.
   * Mirrors the write-back used by the normalize-catalog backfill, and additionally
   * clears any stale Somali localization so indexing re-translates it from the new
   * English (fillLocaleGaps only fills MISSING locale fields).
   */
  applyNormalization(target: any, n: NormalizedProduct): void {
    const origName = target.name;
    const origShort = target.shortDescription;
    const origDesc = target.description;
    const origAttrs = target.attributes;
    const src = n.sourceLang && n.sourceLang !== 'en' ? n.sourceLang : 'tr';
    target.localizations = target.localizations || {};
    if (!target.localizations[src]?.name) {
      target.localizations[src] = { name: origName, shortDescription: origShort, description: origDesc };
    }
    target.localizations.en = {
      name: n.name,
      shortDescription: n.shortDescription ?? origShort,
      description: n.description ?? origDesc,
    };
    target.localizationMeta = target.localizationMeta || {};
    target.localizationMeta.en = { source: 'machine', translatedAt: new Date(), model: this.model };
    // Force Somali to re-translate from the new English (don't leave stale Turkish copy).
    if (target.localizations.so) delete target.localizations.so;
    if (target.localizationMeta.so) delete target.localizationMeta.so;
    if ((!target.rawAttributes || !target.rawAttributes.length) && origAttrs?.length) {
      target.rawAttributes = origAttrs;
    }
    if (n.attributes?.length) target.attributes = n.attributes;
    target.name = n.name; // canonical English becomes the primary name
    target.normalizedAt = new Date();
    target.embeddingInput = undefined; // force re-embed from English on index
  }

  /**
   * For products that are ALREADY English: keep the seller's name/copy untouched but
   * ADD any inferred enrichment attributes (gender, age_group, color, material) the
   * product is missing — so EVERY product carries them (powers the search gender
   * rerank + the Meta/Google ad feed) without rewriting seller input. Returns whether
   * anything was added.
   */
  enrichAttributes(target: any, n: NormalizedProduct): boolean {
    const existing: { key: string; value: string }[] = target.attributes || [];
    const have = (k: string) => existing.some((a) => String(a.key).toLowerCase() === k);
    const ENRICH = new Set(['gender', 'age_group', 'color', 'material']);
    const additions = (n.attributes || []).filter(
      (a) => ENRICH.has(String(a.key).toLowerCase()) && !have(String(a.key).toLowerCase()),
    );
    if (!additions.length) return false;
    target.attributes = [...existing, ...additions];
    return true;
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
    const ageGroup =
      p.ageGroup && ['adult', 'kids'].includes(String(p.ageGroup)) ? String(p.ageGroup) : null;
    if (ageGroup && !attrs.find((a: { key: string }) => a.key === 'age_group'))
      attrs.push({ key: 'age_group', value: ageGroup });
    return {
      sourceLang: (p.sourceLang || 'tr').toString().slice(0, 5),
      name: p.name.trim(),
      shortDescription: p.shortDescription ? String(p.shortDescription).trim() : undefined,
      description: p.description ? String(p.description).trim() : undefined,
      gender,
      ageGroup,
      attributes: attrs,
    };
  }
}
