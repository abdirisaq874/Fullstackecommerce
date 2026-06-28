import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from './opensearch.constants';
import { buildProductIndexBody } from './product-index';

@Injectable()
export class IndexAdminService implements OnModuleInit {
  private readonly logger = new Logger(IndexAdminService.name);

  constructor(
    @Inject(OPENSEARCH_CLIENT) private readonly client: Client,
    private readonly config: ConfigService,
  ) {}

  /** Create the index on boot if OpenSearch is reachable; never crash the app. */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
    } catch (err) {
      this.logger.warn(
        `OpenSearch not ready (${(err as Error).message}). ` +
          `Search will be unavailable until it's up; run "npm run search:reindex" once connected.`,
      );
    }
  }

  get indexName(): string {
    return this.config.get<string>('search.opensearch.productIndex') || 'products_v1';
  }

  private get dims(): number {
    return this.config.get<number>('search.embeddings.dims') || 1024;
  }

  async exists(): Promise<boolean> {
    const res = await this.client.indices.exists({ index: this.indexName });
    return res.body === true;
  }

  /** Create the index if it doesn't already exist. Safe to call on boot. */
  async ensureIndex(): Promise<void> {
    if (await this.exists()) return;
    await this.client.indices.create({
      index: this.indexName,
      body: buildProductIndexBody(this.dims) as any,
    });
    this.logger.log(`Created OpenSearch index "${this.indexName}" (dims=${this.dims})`);
  }

  async deleteIndex(): Promise<void> {
    if (await this.exists()) {
      await this.client.indices.delete({ index: this.indexName });
      this.logger.warn(`Deleted OpenSearch index "${this.indexName}"`);
    }
  }

  /** Drop and recreate — used by the reindex command. */
  async recreateIndex(): Promise<void> {
    await this.deleteIndex();
    await this.ensureIndex();
  }
}
