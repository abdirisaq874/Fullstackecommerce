# Smart Multilingual Search — Architecture, Flow, Timeline & Cost

**Scope:** English + Somali (`en`, `so`). Most-sophisticated build. Engine: **Elasticsearch / OpenSearch (managed)**. Managed AI APIs for translation, embeddings, reranking, and query understanding. Primary datastore stays **MongoDB Atlas** (system of record).

> Decision context: mid-tier e-commerce, expected to grow fast, conversion-focused, **majority non-English (Somali) customers**. Elasticsearch is chosen as the strategic endgame engine (relevance-ops platform + scaling headroom + custom Somali analyzers). The actual Somali conversion quality comes from the **external multilingual models + Somali-first UX**, which are engine-independent.

## 0. Locked stack (v1 — this build)

| Concern | Choice |
|---|---|
| Search engine | **OpenSearch** (single-node Docker in test; managed in prod) |
| Test hosting | **Google Cloud ($300 trial)** — single VM running OpenSearch + Redis via Docker Compose |
| Embeddings | **Cohere `embed-multilingual-v3`** (swappable → Voyage / self-host BGE-M3) |
| Reranker | **Cohere Rerank** (multilingual) |
| Translation | **OpenRouter** (Gemini) for backfill in v1; can move to Google/Azure later |
| Query understanding | **Gemini via OpenRouter** (spellfix, filter parse, dialect expansion, query translation) |
| Frontend i18n | **next-intl**, **English-first** storefront (locales: `en`, `so`) |
| Cache + queue | **Redis** + **@nestjs/bull** (already in the stack) |
| System of record | **MongoDB** (unchanged) |

All AI providers sit behind a swappable interface (`search-engine/providers/*`) — changing a provider is a config + one-file change. Build with OpenAI/whatever is on hand, then A/B Cohere vs Voyage vs BGE-M3 on a Somali eval set.

---

## 1. Current state (what exists today)

- **Backend:** NestJS + MongoDB (Mongoose). Product search = MongoDB `$text` index on `name/description/shortDescription` (`ecommerce-backend/src/products/schemas/product.schema.ts:118`) + regex command palette (`ecommerce-backend/src/search/`).
- **Localization:** seller portal collects 5 locales (`seller-portal-v2/lib/config/reference-data.ts:49`) but the **backend Product schema persists none of it** — localized text is dropped at the API boundary.
- **Frontend:** customer site has no i18n. Search via RTK Query `searchProducts` (`frontend/src/store/api/productsApi.ts:11`).
- **No external search engine.**

---

## 2. Target architecture (high level)

```
                          ┌─────────────────────────────────────────────┐
   Customer query  ─────► │  QUERY UNDERSTANDING (Claude Haiku 4.5)      │
   "kabo cas <$50"        │  normalize · detect lang · spellfix ·        │
                          │  parse filters · expand synonyms · translate │
                          └───────────────┬─────────────────────────────┘
                                          │ {q_en, q_so, filters, intent}
                 ┌────────────────────────┼────────────────────────┐
                 ▼                        ▼                         ▼
        ┌─────────────────┐    ┌────────────────────┐    ┌──────────────────┐
        │ LEXICAL (BM25)  │    │ DENSE VECTOR (kNN)  │    │ filters as        │
        │ Elasticsearch   │    │ Elasticsearch HNSW  │    │ pre-filters       │
        │ en+so analyzers │    │ multilingual embed  │    │                   │
        └────────┬────────┘    └─────────┬──────────┘    └──────────────────┘
                 └───────────┬───────────┘
                             ▼   top ~100
                   ┌───────────────────┐
                   │  FUSION (RRF)     │
                   └─────────┬─────────┘
                             ▼   top ~100 → top ~20
                   ┌───────────────────────────┐
                   │ CROSS-ENCODER RERANK      │  Cohere Rerank / Voyage rerank (multilingual)
                   └─────────┬─────────────────┘
                             ▼
                   ┌───────────────────────────────────────┐
                   │ BUSINESS RE-RANK / personalization     │
                   │ rating · sales · stock · featured ·    │
                   │ recency · margin · user affinity       │
                   └─────────┬─────────────────────────────┘
                             ▼
                   facet · dedupe variants · localize · paginate ─► results

   MongoDB Atlas (source of truth) ──change streams──► Sync worker (BullMQ/Redis)
        translate gaps → embed → index into Elasticsearch
```

Two data paths: an **async indexing path** (write) and a **query path** (read). They share the Elasticsearch index but never block each other.

---

## 3. Components & responsibilities

| Layer | Technology | Role |
|---|---|---|
| System of record | **MongoDB Atlas** | Catalog, orders, users — unchanged |
| Search engine | **Elasticsearch / OpenSearch (managed)** | Lexical BM25 + dense kNN vectors + RRF + filters + facets |
| Sync pipeline | **Mongo change streams → BullMQ (Redis) worker** | Keep ES in sync; run translate + embed off the write path |
| Translation | **Google Cloud Translation v3** or **Azure Translator** (both support Somali) — or **Claude** for context-aware product phrasing | Backfill missing locale text (en↔so) |
| Embeddings | **Voyage `voyage-3.5`** or **Cohere `embed-multilingual-v3`** (multilingual, covers Somali) | One vector per product; cross-lingual semantic recall |
| Reranker | **Cohere Rerank v3.5** or **Voyage `rerank-2`** (multilingual) | Cross-encoder precision pass on top-K |
| Query understanding | **Claude Haiku 4.5** (`claude-haiku-4-5`) + prompt caching | Spellfix, filter parsing, synonym/dialect expansion, query translation |
| Cache | **Redis** | Query-understanding results, query embeddings, rerank results, result pages |
| Frontend i18n | **next-intl** (customer site) | Somali-first UX + localized rendering |

> ⚠️ Elasticsearch's built-in **ELSER** (sparse retrieval) and **Elastic Rerank** are English-only — not used for Somali. Somali quality comes from the external multilingual embedding + reranker, validated on a Somali eval set.

---

## 4. Data model changes (`Product` schema)

Add to `ecommerce-backend/src/products/schemas/product.schema.ts`:

```ts
// Localized text (en + so)
localizations: {
  en?: { name; shortDescription; description },
  so?: { name; shortDescription; description },
}
localizationMeta: {                       // provenance — humans can override machine output
  so?: { source: 'human' | 'machine', translatedAt, model }
}

// Semantic vector (multilingual model → en & so share one space)
embedding:        number[]                // e.g. 1024-dim
embeddingModel:   string                  // version tag → re-embed on upgrade
embeddingInput:   string                  // hash of source text → skip re-embed if unchanged
embeddedAt:       Date

// Denormalized ranking signals (refreshed by a job)
searchSignals: { popularity, salesVelocity, lastOrderedAt }
```

**Elasticsearch index mapping** (separate from Mongo): localized text fields with **custom analyzers** —
- `en` → `english` analyzer
- `so` → custom analyzer: `standard` tokenizer + `icu_folding` + char filters to normalize doubled vowels / `x c q dh kh` variants + a **Somali synonym graph** (dialect + loanwords, hand-curated and grown from search logs)
- `embedding` → `dense_vector` with HNSW kNN, cosine similarity
- structured fields (categoryId, brandId, basePrice, status, avgRating, totalSold) for filters + facets

---

## 5. Indexing flow (write path — fully async)

Trigger: Mongo **change stream** on product create/update → enqueue job (BullMQ/Redis). Worker:

```
1. NORMALIZE text (Somali-aware: lowercase, collapse repeated vowels, unify x/c/q variants)
2. TRANSLATE GAPS (Translation API)
     en present, so missing → translate en→so   (mark source:'machine')
     so present, en missing → translate so→en
3. BUILD EMBEDDING INPUT (name + shortDesc + category + brand + key attrs, en+so)
     └─ if hash == embeddingInput → SKIP embed (cost control)
4. EMBED (embedding API, input_type="document") → write `embedding`
5. INDEX document into Elasticsearch (upsert)
```

Deletes/soft-deletes propagate the same way. Backfill = one batch pass over the existing catalog (use the provider Batch APIs for 50% off).

---

## 6. Query flow (read path)

```
GET /products?q=...&locale=so&category=...&page=...
  0. cache lookup (Redis) — normalized q + filters + locale
  1. QUERY UNDERSTANDING (Claude Haiku 4.5, cached): {q_en, q_so, filters, lang, intent}
  2. PARALLEL retrieve (top ~100 each):
       lexical  → ES BM25 across localizations.en.* + localizations.so.* (fuzzy, field boosts)
       semantic → embed(q) → ES kNN ($vectorSearch equivalent)
       (filters from step 1 applied as pre-filters in both)
  3. FUSE → Reciprocal Rank Fusion → top ~100
  4. RERANK → cross-encoder (Cohere/Voyage) → top ~20
  5. BUSINESS RE-RANK → blend with rating, sales, stock, featured, recency, user affinity
  6. POST → facets, dedupe variants, render localizations[locale] (en fallback), paginate
  7. cache result page
```

Maps onto the existing `PaginatedResponseDto`; frontend `searchProducts` only gains an optional `locale` param.

**Cost-control rules baked in:** only LLM-parse on cache miss; only rerank top-K; cache aggressively.

---

## 7. Backend module structure (NestJS)

```
search/
  query-understanding.service.ts   # Claude Haiku 4.5: spellfix, filter parse, expand, translate query
  retrieval.service.ts             # ES lexical + kNN (THE ONLY engine-coupled file)
  fusion.service.ts                # RRF
  rerank.service.ts                # Cohere/Voyage rerank
  ranking.service.ts               # business signals + personalization
  search.controller.ts            # GET /search, GET /products?q= (swap off Mongo $text)
indexing/
  change-stream.listener.ts        # Mongo → queue
  indexing.consumer.ts             # translate → embed → index into ES
  translation.service.ts
  embedding.service.ts
  es-index.config.ts               # analyzers + mappings
```

Engine-agnostic boundary: only `retrieval.service.ts` + `es-index.config.ts` talk to Elasticsearch. Everything else is portable.

---

## 8. Frontier features (post-MVP, ranked by payoff)

1. **Conversational shopping assistant** — Claude with a `search_products` tool; clarifying questions; RAG over reviews.
2. **Visual search** — image embeddings (`voyage-multimodal-3`/CLIP), second vector field.
3. **Learning-to-Rank** — train ES LTR on real Somali click/purchase data.
4. **Relevance feedback loop** — Kibana dashboards, zero-result/low-CTR mining, A/B harness.
5. **Fine-tuned embeddings** on the catalog + real Somali queries — the ceiling for low-resource quality.

---

## 9. Phased plan & timeline

Assumes **1–2 backend engineers**; the Mongo→ES **sync pipeline** and **frontend i18n** are the long poles.

| Phase | Scope | Effort |
|---|---|---|
| **0** | Persist `en/so` localizations; translation backfill; Redis + BullMQ worker + change streams | ~1.5–2 wks |
| **1** | Provision managed ES; custom en/so analyzers + mappings; Mongo→ES sync; swap lexical search off `$text` | ~2–3 wks |
| **2** | Embeddings + ES kNN + RRF hybrid | ~1.5–2 wks |
| **3** | Cross-encoder rerank + business re-rank | ~1–1.5 wks |
| **4** | Claude query understanding (spellfix, filter parsing, expansion, query translation) | ~1.5–2 wks |
| **5** | Frontend i18n (next-intl) + localized rendering + search analytics | ~2–3 wks |
| **6** | Frontier: agentic assistant / visual search / LTR / personalization | ongoing |

- **Smart-search MVP live (Phases 0–4):** ~**8–11 weeks** (~2–3 months).
- **Full production incl. Somali-first frontend + analytics (through Phase 5):** ~**3–4 months**.
- Add buffer for **Somali model validation** (build a small Somali eval set early — Phase 0/1 — and test every embedding/reranker/translation vendor on it before committing).

---

## 10. Infrastructure to provision

| Item | Purpose | Notes |
|---|---|---|
| **Managed Elasticsearch/OpenSearch** | Search engine | Elastic Cloud **or** AWS OpenSearch Service. HA (3 data nodes), enough RAM to hold the vector (HNSW) index in memory. **Do not self-host** at this stage. |
| **Redis (managed)** | Cache + BullMQ queue | ElastiCache / Upstash / Redis Cloud |
| **Sync worker** | Mongo→ES indexing | Runs on existing backend infra or a small dedicated container |
| **API keys** | Translation, embeddings, rerank, Claude | Store in secrets manager |

MongoDB Atlas stays as is.

---

## 11. Cost estimate

**Assumptions (rescale to your actuals):** ~50,000 products; ~100,000 searches/month to start. Per-unit math given so you can project growth.

**One-time backfill**
| Item | Math | Cost |
|---|---|---|
| Translation (en→so, ~700 chars/product) | 50k × 700 = 35M chars | **$350** (Azure $10/M) – **$700** (Google $20/M) |
| Embeddings (~400 tokens/product) | 50k × 400 = 20M tokens | **~$1–2** (Voyage/Cohere) |

**Recurring monthly (at ~100k searches/mo)**
| Item | Math | Cost/mo |
|---|---|---|
| Managed Elasticsearch/OpenSearch | HA prod cluster + vectors in RAM | **$300–800** |
| Cross-encoder rerank | top-100/query; Voyage cheaper than Cohere | **$50–200** |
| Claude Haiku 4.5 query understanding | ~$0.001/query w/ prompt caching, cache-miss only | **$50–150** |
| Query embeddings | ~20 tok/query | **~$1** |
| Translation (ongoing new/updated products) | ~5k/mo × 700 chars | **$35–70** |
| Redis (managed) | small instance | **$15–50** |
| **Total** | | **~$450–1,270/mo** |

**Scaling note:** rerank + query-understanding + query-embedding costs scale ~linearly with search volume but are heavily reduced by Redis caching (repeated queries are free). At 1M searches/month, rerank dominates (~$500–2,000/mo) — mitigate with caching and Voyage's token pricing. ES cost scales with catalog size + traffic, not search count.

---

## 12. Key risks & must-dos

- **Validate Somali quality empirically.** Vendor "multilingual" claims vary on low-resource languages. Build a Somali eval set in Phase 0; test embed + rerank + translate before committing. This is the single most important de-risking step.
- **The sync pipeline is the real engineering work**, not Elasticsearch itself. Budget for backfill, reindex/migration, deletes, consistency.
- **Embedding version tag** + a re-embed batch job for model upgrades.
- **Somali-first UX is non-negotiable for conversion** — an English-only storefront wastes the search investment.
- **Cache or it gets expensive.** Only LLM-parse cache misses; only rerank top-K; cache result pages.

---

## 13. Decisions to lock before build

1. **Engine:** OpenSearch (AWS, Apache-2.0) vs Elasticsearch (Elastic Cloud).
2. **Embedding + rerank vendor:** Voyage vs Cohere (decide on Somali eval results).
3. **Translation provider:** Google/Azure (cheap, scalable) vs Claude (context-aware quality).
4. **v1 includes Learning-to-Rank?** Or defer to Phase 6.
5. **Personalization in v1?** Or defer.
