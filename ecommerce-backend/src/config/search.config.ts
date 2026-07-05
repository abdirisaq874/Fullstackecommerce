import { registerAs } from '@nestjs/config';

const bool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

/**
 * Configuration for the smart multilingual search subsystem.
 * Every AI capability is feature-flagged: with no provider keys set the system
 * degrades gracefully to lexical-only (BM25) search so it still runs end to end.
 */
export default registerAs('search', () => ({
  opensearch: {
    node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
    username: process.env.OPENSEARCH_USERNAME || undefined,
    password: process.env.OPENSEARCH_PASSWORD || undefined,
    productIndex: process.env.SEARCH_PRODUCT_INDEX || 'products_v1',
  },

  locales: (process.env.SEARCH_LOCALES || 'en,so')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean),
  defaultLocale: process.env.SEARCH_DEFAULT_LOCALE || 'en',

  flags: {
    vector: bool(process.env.SEARCH_ENABLE_VECTOR, true),
    rerank: bool(process.env.SEARCH_ENABLE_RERANK, true),
    queryUnderstanding: bool(process.env.SEARCH_ENABLE_QUERY_UNDERSTANDING, true),
    translation: bool(process.env.SEARCH_ENABLE_TRANSLATION, true),
  },

  // Minimum k-NN score (Lucene cosinesimil, ~[0,1]) a vector hit must clear to
  // count as a real semantic match — cuts the ~0.80 "everything is a bit
  // similar" noise so vector doesn't flood results with the whole catalog.
  vectorMinScore: parseFloat(process.env.SEARCH_VECTOR_MIN_SCORE || '0.85'),

  embeddings: {
    provider: (process.env.EMBEDDINGS_PROVIDER || 'cohere').toLowerCase(),
    dims: parseInt(process.env.EMBEDDINGS_DIMS || '1024', 10),
    cohere: {
      apiKey: process.env.COHERE_API_KEY || '',
      model: process.env.COHERE_EMBED_MODEL || 'embed-multilingual-v3.0',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
    },
    // OpenRouter (OpenAI-compatible). Qwen3-Embedding-8B → sliced to `dims` +
    // L2-normalized, matching the category-classification vectors.
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_EMBED_MODEL || 'qwen/qwen3-embedding-8b',
    },
  },

  rerank: {
    provider: (process.env.RERANK_PROVIDER || 'cohere').toLowerCase(),
    cohere: {
      apiKey: process.env.COHERE_API_KEY || '',
      model: process.env.COHERE_RERANK_MODEL || 'rerank-multilingual-v3.0',
    },
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    translationModel:
      process.env.OPENROUTER_TRANSLATION_MODEL || 'google/gemini-2.0-flash-001',
    queryUnderstandingModel:
      process.env.OPENROUTER_QU_MODEL || 'google/gemini-2.0-flash-001',
  },
}));
