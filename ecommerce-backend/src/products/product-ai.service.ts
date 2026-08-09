import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './schemas/product.schema';
import { postJson } from '../search-engine/providers/http.util';

export interface AiDraftInput {
  name: string;
  brief?: string;
  brand?: string;
  attributes?: { key: string; value: string }[];
  imageUrl?: string;
}
export interface ProductDraft {
  shortDescription: string;
  description: string;
  tags: string[];
  keywords: string[];
  categoryId: string | null;
  categoryPath: string;
}

const EMBED_DIM = 1024;
const CATEGORY_TOP_K = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CatVec { id: string; name: string; path: string; vec: Float32Array; }

/**
 * Seller-facing AI (OpenRouter): generate product copy (optionally from the
 * product image via a vision model) and auto-classify into the Google taxonomy
 * using embeddings + an LLM re-rank. Category assignment is system-owned.
 */
@Injectable()
export class ProductAiService {
  private readonly logger = new Logger(ProductAiService.name);
  private catCache: CatVec[] | null = null;
  private cacheAt = 0;

  constructor(@InjectModel(Category.name) private readonly categoryModel: Model<Category>) {}

  private get cfg() {
    return {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      // Gemma-4-26b handles both text copy and vision (image → attributes).
      chatModel: process.env.OPENROUTER_GEN_MODEL || 'google/gemma-4-26b-a4b-it',
      visionModel: process.env.OPENROUTER_VISION_MODEL || 'google/gemma-4-26b-a4b-it',
      embedModel: process.env.OPENROUTER_EMBED_MODEL || 'qwen/qwen3-embedding-8b',
    };
  }

  get enabled(): boolean {
    const k = this.cfg.apiKey;
    return !!k && !k.startsWith('PLACEHOLDER');
  }

  private headers() { return { Authorization: `Bearer ${this.cfg.apiKey}` }; }

  /** Chat call → parsed JSON. Uses the vision model when an image URL is supplied. */
  private async chat(system: string, user: string, imageUrl?: string): Promise<any> {
    const useVision = !!imageUrl;
    const userContent: any = useVision
      ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: imageUrl } }]
      : user;
    const res = await postJson<any>(
      `${this.cfg.baseUrl}/chat/completions`,
      {
        model: useVision ? this.cfg.visionModel : this.cfg.chatModel,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      },
      this.headers(),
      40000,
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

  async embed(text: string): Promise<Float32Array> {
    const res = await postJson<any>(
      `${this.cfg.baseUrl}/embeddings`,
      { model: this.cfg.embedModel, input: text },
      this.headers(),
      30000,
    );
    const raw: number[] = res?.data?.[0]?.embedding;
    if (!Array.isArray(raw)) throw new Error('No embedding returned');
    return normalize(raw.slice(0, EMBED_DIM));
  }

  /** Build the context string fed to the copy generator. */
  private context(input: AiDraftInput): string {
    const parts = [`Product name: ${input.name}`];
    if (input.brand) parts.push(`Brand: ${input.brand}`);
    if (input.attributes?.length) {
      parts.push(`Attributes: ${input.attributes.map((a) => `${a.key}=${a.value}`).join(', ')}`);
    }
    if (input.brief) parts.push(`Seller note: ${input.brief}`);
    if (input.imageUrl) parts.push('An image of the product is attached — use it to infer color, material and form.');
    return parts.join('\n');
  }

  async enrich(input: AiDraftInput) {
    const system =
      'You write product descriptions for an online marketplace. Using the product ' +
      'details (and the attached image if present), return ONLY JSON: ' +
      '{"shortDescription": string (max 160 chars — a plain one-line summary of what ' +
      'the item is, no hype), "description": string (2-4 short plain-text paragraphs, ' +
      'no markdown), "tags": string[] (5-10 short lowercase tags), "keywords": string[] ' +
      '(6-12 SEO keywords)}. Write in clear, factual English. Open by stating plainly ' +
      'what the product IS, then cover its materials, features and typical use. Do NOT ' +
      'use marketing clichés or hype — never use words/phrases like "Make a statement", ' +
      '"Elevate", "Introducing", "Discover", "Stunning", "Timeless", "Effortless", ' +
      '"must-have", or exclamation marks. Only describe attributes supported by the ' +
      'given details; do not invent specs.';
    let out: any;
    try {
      out = await this.chat(system, this.context(input), input.imageUrl);
    } catch (e) {
      if (!input.imageUrl) throw e;
      // Image not reachable / vision provider hiccup → still generate from text.
      this.logger.warn(`vision enrich failed, retrying text-only: ${(e as Error).message}`);
      out = await this.chat(system, this.context({ ...input, imageUrl: undefined }));
    }
    return {
      shortDescription: String(out.shortDescription || '').slice(0, 200),
      description: String(out.description || ''),
      tags: Array.isArray(out.tags) ? out.tags.slice(0, 12).map(String) : [],
      keywords: Array.isArray(out.keywords) ? out.keywords.slice(0, 15).map(String) : [],
    };
  }

  private async ensureCache(): Promise<CatVec[]> {
    if (this.catCache && Date.now() - this.cacheAt < CACHE_TTL_MS) return this.catCache;
    const all = await this.categoryModel.find({ isActive: true }).select('name').lean();
    const nameById = new Map(all.map((c: any) => [String(c._id), c.name as string]));
    const withVec = await this.categoryModel
      .find({ isActive: true, embedding: { $exists: true, $ne: null } })
      .select('name ancestors +embedding')
      .lean();
    this.catCache = withVec
      .filter((c: any) => Array.isArray(c.embedding) && c.embedding.length)
      .map((c: any) => ({
        id: String(c._id),
        name: c.name,
        path: [...(c.ancestors || []).map((a: any) => nameById.get(String(a)) || ''), c.name].filter(Boolean).join(' › '),
        vec: Float32Array.from(c.embedding),
      }));
    this.cacheAt = Date.now();
    this.logger.log(`Loaded ${this.catCache.length} category embeddings`);
    return this.catCache;
  }

  private async classifyByEmbeddings(text: string): Promise<{ categoryId: string; categoryPath: string } | null> {
    const cats = await this.ensureCache();
    if (!cats.length) return null;
    const q = await this.embed(text);
    const ranked = cats.map((c) => ({ c, s: dot(q, c.vec) })).sort((a, b) => b.s - a.s).slice(0, CATEGORY_TOP_K);
    let chosen = ranked[0].c;
    try {
      const out = await this.chat(
        'You assign products to a category taxonomy. The numbered list below is already the ' +
          'most semantically similar categories. Pick the SINGLE best fit. Return ONLY JSON {"choice": number}.',
        `Product: ${text}\n\nCandidate categories:\n${ranked.map((r, i) => `${i + 1}. ${r.c.path}`).join('\n')}`,
      );
      const idx = Number(out?.choice);
      if (idx >= 1 && idx <= ranked.length) chosen = ranked[idx - 1].c;
    } catch (e) {
      this.logger.warn(`re-rank failed, using nearest: ${(e as Error).message}`);
    }
    return { categoryId: chosen.id, categoryPath: chosen.path };
  }

  private async classifyByTree(text: string): Promise<{ categoryId: string | null; categoryPath: string }> {
    let parentId: any = null;
    const path: string[] = [];
    let leafId: string | null = null;
    for (let depth = 0; depth < 6; depth += 1) {
      const filter = depth === 0 ? { depth: 0, isActive: true } : { parentId, isActive: true };
      const children = await this.categoryModel.find(filter).select('name').lean();
      if (!children.length) break;
      if (children.length === 1) { path.push(children[0].name); leafId = String(children[0]._id); parentId = children[0]._id; continue; }
      const listed = children as any[];
      const out = await this.chat(
        'Pick the SINGLE best-fitting category from the list. Return ONLY JSON {"choice": number} — the number, or 0 if none fits.',
        `Product: ${text}\n\nCategories:\n${listed.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`,
      );
      const idx = Number(out?.choice);
      if (!idx || idx < 1 || idx > listed.length) break;
      path.push(listed[idx - 1].name); leafId = String(listed[idx - 1]._id); parentId = listed[idx - 1]._id;
    }
    return { categoryId: leafId, categoryPath: path.join(' › ') };
  }

  async classify(text: string): Promise<{ categoryId: string | null; categoryPath: string }> {
    try {
      const viaEmb = await this.classifyByEmbeddings(text);
      if (viaEmb) return viaEmb;
    } catch (e) {
      this.logger.warn(`embedding classify failed, tree fallback: ${(e as Error).message}`);
    }
    return this.classifyByTree(text);
  }

  /**
   * Cheap category assignment from an ALREADY-computed embedding — cosine
   * nearest category, no extra API call (no query-embed, LLM re-rank or tree
   * walk). For bulk backfills where one embedding serves both product + category.
   */
  async nearestCategory(vec: number[] | Float32Array): Promise<{ categoryId: string; categoryPath: string } | null> {
    const cats = await this.ensureCache();
    if (!cats.length) return null;
    const q = vec instanceof Float32Array ? vec : Float32Array.from(vec);
    let best = cats[0];
    let bestScore = -Infinity;
    for (const c of cats) {
      const s = dot(q, c.vec);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return { categoryId: best.id, categoryPath: best.path };
  }

  async draft(input: AiDraftInput): Promise<ProductDraft> {
    if (!this.enabled) throw new BadRequestException('AI is not configured (set a real OPENROUTER_API_KEY).');
    if (!input?.name?.trim()) throw new BadRequestException('Product name is required.');
    const enriched = await this.enrich(input);
    const attrText = input.attributes?.length ? ' ' + input.attributes.map((a) => a.value).join(' ') : '';
    const cls = await this.classify(`${input.name}. ${enriched.shortDescription}${attrText}`);
    this.logger.log(`AI draft "${input.name}"${input.imageUrl ? ' (+image)' : ''} → ${cls.categoryPath || '(none)'}`);
    return { ...enriched, ...cls };
  }
}

function normalize(v: number[]): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i += 1) out[i] = v[i] / n;
  return out;
}
function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) s += a[i] * b[i];
  return s;
}
