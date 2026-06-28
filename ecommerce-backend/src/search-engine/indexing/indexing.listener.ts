import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { SEARCH_INDEXING_QUEUE } from './indexing.processor';

/**
 * Bridges existing product domain events to the search index. ProductService
 * already emits product.created / product.updated / product.archived via the
 * EventBus (EventEmitter2), so we just enqueue index jobs — no changes needed
 * to the product write path.
 */
@Injectable()
export class IndexingListener {
  private readonly logger = new Logger(IndexingListener.name);

  constructor(@InjectQueue(SEARCH_INDEXING_QUEUE) private readonly queue: Queue) {}

  @OnEvent('product.created')
  @OnEvent('product.updated')
  async onUpsert(payload: { productId: string }): Promise<void> {
    if (payload?.productId) await this.enqueue('upsert', payload.productId);
  }

  @OnEvent('product.archived')
  async onArchived(payload: { productId: string }): Promise<void> {
    if (payload?.productId) await this.enqueue('remove', payload.productId);
  }

  private async enqueue(type: 'upsert' | 'remove', productId: string): Promise<void> {
    await this.queue.add(
      type,
      { productId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: 100 },
    );
  }
}
