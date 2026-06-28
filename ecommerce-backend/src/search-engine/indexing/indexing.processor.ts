import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { IndexingService } from './indexing.service';

export const SEARCH_INDEXING_QUEUE = 'search-indexing';

interface IndexJob {
  productId: string;
}

/** Bull worker that runs translate → embed → index off the request path. */
@Processor(SEARCH_INDEXING_QUEUE)
export class IndexingProcessor {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(private readonly indexing: IndexingService) {}

  @Process('upsert')
  async handleUpsert(job: Job<IndexJob>): Promise<void> {
    await this.indexing.indexProduct(job.data.productId);
  }

  @Process('remove')
  async handleRemove(job: Job<IndexJob>): Promise<void> {
    await this.indexing.removeProduct(job.data.productId);
  }
}
