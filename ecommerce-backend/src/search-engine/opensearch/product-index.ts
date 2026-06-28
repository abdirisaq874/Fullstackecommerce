/**
 * OpenSearch index definition for products: per-language analyzers (en/so),
 * nested attributes for dynamic facets, and a knn_vector for semantic search.
 *
 * Somali notes: there is no off-the-shelf Somali analyzer. We approximate with
 * a plugin-free custom analyzer — lowercase + asciifolding + a doubled-vowel
 * collapse (Somali long vowels are written aa/ee/ii/oo/uu) + a hand-curated
 * synonym graph that grows from search logs. The heavy lifting for Somali recall
 * is the multilingual embedding + reranker, not lexical analysis.
 */

// Starter Somali ⇄ English synonym graph. Grow this from real query logs.
export const SOMALI_SYNONYMS: string[] = [
  'kabo, kab, shoes, shoe',
  'dhar, clothes, clothing, apparel',
  'taleefan, telefoon, phone, smartphone, mobile',
  'koombiyuutar, computer, laptop',
  'guri, home, house',
  'caruur, kids, children, baby',
  'midab cas, red, casaan',
  'cad, white, caddaan',
  'madow, black',
];

export function buildProductIndexBody(dims: number) {
  return {
    settings: {
      index: {
        knn: true,
        'knn.algo_param.ef_search': 100,
        number_of_shards: 1,
        number_of_replicas: 0, // single-node test default; raise in prod
      },
      analysis: {
        char_filter: {
          // Collapse repeated vowels (Somali long-vowel spelling variance).
          collapse_long_vowels: {
            type: 'pattern_replace',
            pattern: '([aeiou])\\1+',
            replacement: '$1',
          },
        },
        filter: {
          english_stop: { type: 'stop', stopwords: '_english_' },
          somali_synonyms: { type: 'synonym_graph', synonyms: SOMALI_SYNONYMS },
        },
        analyzer: {
          en_text: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding', 'english_stop'],
          },
          so_text: {
            type: 'custom',
            char_filter: ['collapse_long_vowels'],
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding', 'somali_synonyms'],
          },
        },
      },
    },
    mappings: {
      dynamic: false,
      properties: {
        productId: { type: 'keyword' },
        slug: { type: 'keyword' },
        sellerId: { type: 'keyword' },
        status: { type: 'keyword' },
        isFeatured: { type: 'boolean' },
        inStock: { type: 'boolean' },

        categoryId: { type: 'keyword' },
        categorySlug: { type: 'keyword' },
        categoryAncestors: { type: 'keyword' }, // ancestor category ids (subtree filtering)
        brandId: { type: 'keyword' },
        brandSlug: { type: 'keyword' },
        imageUrl: { type: 'keyword', index: false }, // stored for display, not searched

        // Localized text — one field per locale, each with its own analyzer
        name_en: { type: 'text', analyzer: 'en_text', fields: { kw: { type: 'keyword' } } },
        name_so: { type: 'text', analyzer: 'so_text' },
        shortDescription_en: { type: 'text', analyzer: 'en_text' },
        shortDescription_so: { type: 'text', analyzer: 'so_text' },
        description_en: { type: 'text', analyzer: 'en_text' },
        description_so: { type: 'text', analyzer: 'so_text' },

        // Numeric / signal fields
        basePrice: { type: 'float' },
        currency: { type: 'keyword' },
        avgRating: { type: 'float' },
        reviewCount: { type: 'integer' },
        totalSold: { type: 'integer' },
        popularity: { type: 'float' },
        salesVelocity: { type: 'float' },
        createdAt: { type: 'date' },

        // Nested attributes → dynamic facets + filtering
        attributes: {
          type: 'nested',
          properties: {
            key: { type: 'keyword' },
            value: { type: 'keyword' },
            valueNum: { type: 'double' },
          },
        },

        // Semantic vector
        embedding: {
          type: 'knn_vector',
          dimension: dims,
          method: {
            name: 'hnsw',
            space_type: 'cosinesimil',
            engine: 'lucene',
            parameters: { ef_construction: 128, m: 16 },
          },
        },
      },
    },
  };
}
