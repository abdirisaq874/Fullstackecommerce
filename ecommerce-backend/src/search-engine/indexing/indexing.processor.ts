import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IndexingService } from './indexing.service';

export const SEARCH_INDEXING_QUEUE = 'search-indexing';

interface IndexJob {
  productId: string;
}

/** BullMQ worker that runs translate → embed → index off the request path. */
@Processor(SEARCH_INDEXING_QUEUE)
export class IndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(private readonly indexing: IndexingService) {
    super();
  }

  async process(job: Job<IndexJob>): Promise<void> {
    switch (job.name) {
      case 'upsert':
        await this.indexing.indexProduct(job.data.productId);
        return;
      case 'remove':
        await this.indexing.removeProduct(job.data.productId);
        return;
      default:
        this.logger.warn(`Unknown indexing job: ${job.name}`);
    }
  }
}
