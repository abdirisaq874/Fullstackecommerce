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

const EMBED_DIM = 1024; // truncate Qwen3-Embedding-8B (4096) via Matryoshka for lean storage
const CATEGORY_TOP_K = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CatVec {
  id: string;
  name: string;
  path: string;
  vec: Float32Array;
}

/**
 * Seller-facing AI (OpenRouter): generate product copy and auto-classify into the
 * Google taxonomy using semantic embeddings (Qwen3-Embedding-8B) + an LLM pick.
 * Category assignment is system-owned; sellers never choose categories.
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
      chatModel: process.env.OPENROUTER_GEN_MODEL || 'qwen/qwen-2.5-7b-instruct',
      embedModel: process.env.OPENROUTER_EMBED_MODEL || 'qwen/qwen3-embedding-8b',
    };
  }

  get enabled(): boolean {
    const k = this.cfg.apiKey;
    return !!k && !k.startsWith('PLACEHOLDER');
  }

  private headers() {
    return { Authorization: `Bearer ${this.cfg.apiKey}` };
  }

  /** One OpenRouter chat call → parsed JSON object (tolerant of prose around it). */
  private async chat(system: string, user: string): Promise<any> {
    const res = await postJson<any>(
      `${this.cfg.baseUrl}/chat/completions`,
      {
        model: this.cfg.chatModel,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      this.headers(),
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

  /** Embed text with Qwen3-Embedding-8B, truncated to EMBED_DIM and L2-normalized. */
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

  /** Generate marketing copy from the product name (+ optional seller note). */
  async enrich(name: string, brief?: string) {
    const system =
      'You are an expert e-commerce copywriter. Given a product, return ONLY JSON ' +
      'with this shape: {"shortDescription": string (max 160 chars, punchy), ' +
      '"description": string (2-4 short plain-text paragraphs, no markdown), ' +
      '"tags": string[] (5-10 short lowercase tags), ' +
      '"keywords": string[] (6-12 SEO search keywords)}. Write in English.';
    const out = await this.chat(system, `Product name: ${name}${brief ? `\nSeller note: ${brief}` : ''}`);
    return {
      shortDescription: String(out.shortDescription || '').slice(0, 200),
      description: String(out.description || ''),
      tags: Array.isArray(out.tags) ? out.tags.slice(0, 12).map(String) : [],
      keywords: Array.isArray(out.keywords) ? out.keywords.slice(0, 15).map(String) : [],
    };
  }

  /** Load + cache category name-paths and their embedding vectors. */
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
        path: [...(c.ancestors || []).map((a: any) => nameById.get(String(a)) || ''), c.name]
          .filter(Boolean)
          .join(' › '),
        vec: Float32Array.from(c.embedding),
      }));
    this.cacheAt = Date.now();
    this.logger.log(`Loaded ${this.catCache.length} category embeddings into cache`);
    return this.catCache;
  }

  /** Embeddings + LLM hybrid: nearest categories by cosine, then LLM picks the best. */
  private async classifyByEmbeddings(text: string): Promise<{ categoryId: string; categoryPath: string } | null> {
    const cats = await this.ensureCache();
    if (!cats.length) return null; // backfill not run yet → caller falls back to tree walk
    const q = await this.embed(text);
    const ranked = cats
      .map((c) => ({ c, s: dot(q, c.vec) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, CATEGORY_TOP_K);

    const list = ranked.map((r, i) => `${i + 1}. ${r.c.path}`).join('\n');
    let chosen = ranked[0].c; // default to nearest neighbor
    try {
      const out = await this.chat(
        'You assign products to a category taxonomy. The numbered list below is already the ' +
          'most semantically similar categories. Pick the SINGLE best fit for the product. ' +
          'Return ONLY JSON {"choice": number}.',
        `Product: ${text}\n\nCandidate categories:\n${list}`,
      );
      const idx = Number(out?.choice);
      if (idx >= 1 && idx <= ranked.length) chosen = ranked[idx - 1].c;
    } catch (e) {
      this.logger.warn(`LLM re-rank failed, using nearest neighbor: ${(e as Error).message}`);
    }
    return { categoryId: chosen.id, categoryPath: chosen.path };
  }

  /** Fallback: greedy top-down tree walk (no embeddings needed). */
  private async classifyByTree(text: string): Promise<{ categoryId: string | null; categoryPath: string }> {
    let parentId: any = null;
    const path: string[] = [];
    let leafId: string | null = null;
    for (let depth = 0; depth < 6; depth += 1) {
      const filter = depth === 0 ? { depth: 0, isActive: true } : { parentId, isActive: true };
      const children = await this.categoryModel.find(filter).select('name').lean();
      if (!children.length) break;
      if (children.length === 1) {
        path.push(children[0].name); leafId = String(children[0]._id); parentId = children[0]._id; continue;
      }
      const listed = children as any[];
      const out = await this.chat(
        'Pick the SINGLE best-fitting category for the product from the numbered list. ' +
          'Return ONLY JSON {"choice": number} — the number, or 0 if none fits.',
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
      this.logger.warn(`Embedding classify failed, falling back to tree: ${(e as Error).message}`);
    }
    return this.classifyByTree(text);
  }

  /** Full draft: copy + auto-assigned category. */
  async draft(name: string, brief?: string): Promise<ProductDraft> {
    if (!this.enabled) throw new BadRequestException('AI is not configured (set a real OPENROUTER_API_KEY).');
    if (!name?.trim()) throw new BadRequestException('Product name is required.');
    const enriched = await this.enrich(name, brief);
    const cls = await this.classify(`${name}. ${enriched.shortDescription}`);
    this.logger.log(`AI draft "${name}" → ${cls.categoryPath || '(no category)'}`);
    return { ...enriched, ...cls };
  }
}

/* ── vector helpers ── */
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
