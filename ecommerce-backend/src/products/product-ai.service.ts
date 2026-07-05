import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './schemas/product.schema';
import { postJson } from '../search-engine/providers/http.util';

export interface ProductDraft {
  shortDescription: string;
  description: string;
  tags: string[];
  keywords: string[];
  categoryId: string | null;
  categoryPath: string;
}

/**
 * Seller-facing AI: generate product copy (description/tags/keywords) and
 * auto-classify the product into the Google taxonomy — via OpenRouter (Gemini).
 * Category assignment is system-owned; sellers never pick categories.
 */
@Injectable()
export class ProductAiService {
  private readonly logger = new Logger(ProductAiService.name);

  constructor(@InjectModel(Category.name) private readonly categoryModel: Model<Category>) {}

  private get cfg() {
    return {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model:
        process.env.OPENROUTER_GEN_MODEL ||
        process.env.OPENROUTER_QU_MODEL ||
        'google/gemini-2.0-flash-001',
    };
  }

  get enabled(): boolean {
    const k = this.cfg.apiKey;
    return !!k && !k.startsWith('PLACEHOLDER');
  }

  /** One OpenRouter chat call constrained to a JSON object. */
  private async chat(system: string, user: string): Promise<any> {
    const { apiKey, baseUrl, model } = this.cfg;
    const res = await postJson<any>(
      `${baseUrl}/chat/completions`,
      {
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { Authorization: `Bearer ${apiKey}` },
      30000,
    );
    const content: string = res?.choices?.[0]?.message?.content ?? '';
    try {
      return JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('AI returned non-JSON');
    }
  }

  /** Generate marketing copy from the product name (+ optional seller note). */
  async enrich(name: string, brief?: string) {
    const system =
      'You are an expert e-commerce copywriter. Given a product, return STRICT JSON ' +
      'with this shape: {"shortDescription": string (max 160 chars, punchy), ' +
      '"description": string (2-4 short plain-text paragraphs, no markdown), ' +
      '"tags": string[] (5-10 short lowercase tags), ' +
      '"keywords": string[] (6-12 SEO search keywords)}. Write in English. Return ONLY JSON.';
    const user = `Product name: ${name}${brief ? `\nSeller note: ${brief}` : ''}`;
    const out = await this.chat(system, user);
    return {
      shortDescription: String(out.shortDescription || '').slice(0, 200),
      description: String(out.description || ''),
      tags: Array.isArray(out.tags) ? out.tags.slice(0, 12).map(String) : [],
      keywords: Array.isArray(out.keywords) ? out.keywords.slice(0, 15).map(String) : [],
    };
  }

  private async pick(text: string, options: { _id: any; name: string }[]) {
    if (options.length === 1) return options[0];
    const list = options.map((o, i) => `${i + 1}. ${o.name}`).join('\n');
    const system =
      'You classify products into a category taxonomy. Pick the SINGLE best-fitting ' +
      'category for the product from the numbered list. Return STRICT JSON {"choice": number} ' +
      '— the number, or 0 if none is a reasonable fit.';
    const out = await this.chat(system, `Product: ${text}\n\nCategories:\n${list}`);
    const idx = Number(out?.choice);
    if (!idx || idx < 1 || idx > options.length) return null;
    return options[idx - 1];
  }

  /** Walk the taxonomy top→down, letting the model choose at each level. */
  async classify(text: string): Promise<{ categoryId: string | null; categoryPath: string }> {
    let parentId: any = null;
    const path: string[] = [];
    let leafId: string | null = null;

    for (let depth = 0; depth < 6; depth += 1) {
      const filter = depth === 0 ? { depth: 0, isActive: true } : { parentId, isActive: true };
      const children = await this.categoryModel.find(filter).select('name').lean();
      if (!children.length) break;
      const chosen = await this.pick(text, children as any);
      if (!chosen) break;
      path.push(chosen.name);
      leafId = String(chosen._id);
      parentId = chosen._id;
    }
    return { categoryId: leafId, categoryPath: path.join(' › ') };
  }

  /** Full draft: copy + auto-assigned category. */
  async draft(name: string, brief?: string): Promise<ProductDraft> {
    if (!this.enabled) {
      throw new BadRequestException('AI is not configured (set a real OPENROUTER_API_KEY).');
    }
    if (!name?.trim()) throw new BadRequestException('Product name is required.');

    const enriched = await this.enrich(name, brief);
    const cls = await this.classify(`${name}. ${enriched.shortDescription}`);
    this.logger.log(`AI draft for "${name}" → ${cls.categoryPath || '(no category)'}`);
    return { ...enriched, ...cls };
  }
}
