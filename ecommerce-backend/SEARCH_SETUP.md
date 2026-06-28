# Smart Search — Setup & Run

Backend subsystem: OpenSearch hybrid search (BM25 + kNN) → RRF → Cohere rerank →
business re-rank → dynamic facets, with Gemini (OpenRouter) query understanding
and translation, and Cohere multilingual embeddings. All AI is feature-flagged;
with no keys set it runs **lexical-only** so nothing blocks.

## 1. Start the test stack (OpenSearch + Dashboards + Redis)

```bash
cd ecommerce-backend
docker compose -f docker-compose.search.yml up -d
# OpenSearch  → http://localhost:9200
# Dashboards  → http://localhost:5601   (relevance tuning / index inspection)
```

On a GCloud VM (the $300 trial test box), run the same compose file and point
`OPENSEARCH_NODE` at it.

## 2. Configure env

Copy the relevant lines from `.env.search.example` into `.env`. Minimum to run:

```
OPENSEARCH_NODE=http://localhost:9200
```

Add provider keys to enable the smart layers (any subset works):

```
COHERE_API_KEY=...        # embeddings + rerank (multilingual)
OPENROUTER_API_KEY=...    # Gemini: query understanding + translation
```

## 3. Install & seed

```bash
npm install
npm run seed:categories     # localized (en/so) taxonomy + facet config
```

## 4. Index products

```bash
npm run search:reindex                 # create index + index all active products
npm run search:reindex -- --recreate   # after mapping/dimension changes
```

Reindex runs the full enrichment per product (translate missing locales → embed →
index), so it doubles as the one-time backfill. New/updated/archived products are
kept in sync automatically via the existing `product.*` domain events → Bull queue.

## 5. Query

```bash
# English
curl "http://localhost:3000/api/v1/catalog/search?q=running%20shoes&locale=en&limit=10"

# Somali (cross-lingual: Somali query → English catalog via embeddings)
curl "http://localhost:3000/api/v1/catalog/search?q=kabo&locale=so"

# With filters + dynamic attribute facets
curl "http://localhost:3000/api/v1/catalog/search?q=phone&category=mobile-phones&priceMax=500&attr=color:black&attr=storage:128GB"
```

Response: `{ data[], meta{}, facets[], query{ understood, appliedFilters } }`.
`facets` adapts to the searched category (e.g. storage/RAM/colour for phones).

> Note the global API prefix (e.g. `/api/v1`) per `main.ts`; adjust the path above to match.

## Provider swap (Somali eval)

Everything AI is behind `src/search-engine/providers/*` and chosen by env:
- `EMBEDDINGS_PROVIDER=cohere|openai` (swap to Voyage/BGE-M3 by adding a branch)
- `RERANK_PROVIDER=cohere`
- Translation/QU model via `OPENROUTER_*`

Build a small Somali eval set and A/B providers before committing — this is where
Somali relevance is won.
