import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';

import {
  Product,
  ProductSchema,
  Category,
  CategorySchema,
  Brand,
  BrandSchema,
} from '../products/schemas/product.schema';

import { opensearchClientProvider } from './opensearch/opensearch.provider';
import { IndexAdminService } from './opensearch/index-admin.service';

import { EmbeddingsService } from './providers/embeddings.service';
import { TranslationService } from './providers/translation.service';
import { RerankService } from './providers/rerank.service';
import { QueryUnderstandingService } from './providers/query-understanding.service';

import { IndexingService } from './indexing/indexing.service';
import { IndexingProcessor, SEARCH_INDEXING_QUEUE } from './indexing/indexing.processor';
import { IndexingListener } from './indexing/indexing.listener';

import { RetrievalService } from './retrieval/retrieval.service';
import { FacetsService } from './retrieval/facets.service';
import { SearchLogService } from './analytics/search-log.service';
import { CatalogSearchService } from './search.service';
import { CatalogSearchController } from './catalog-search.controller';

/**
 * Smart multilingual search subsystem (OpenSearch + AI providers).
 * Engine-coupled code is confined to opensearch/ + retrieval/; everything else
 * is portable. AI providers are feature-flagged and degrade to lexical-only.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Brand.name, schema: BrandSchema },
    ]),
    BullModule.registerQueue({ name: SEARCH_INDEXING_QUEUE }),
  ],
  controllers: [CatalogSearchController],
  providers: [
    opensearchClientProvider,
    IndexAdminService,
    // AI providers
    EmbeddingsService,
    TranslationService,
    RerankService,
    QueryUnderstandingService,
    // indexing
    IndexingService,
    IndexingProcessor,
    IndexingListener,
    // retrieval + orchestration
    RetrievalService,
    FacetsService,
    SearchLogService,
    CatalogSearchService,
  ],
  exports: [IndexingService, IndexAdminService, RetrievalService, EmbeddingsService],
})
export class SearchEngineModule {}
