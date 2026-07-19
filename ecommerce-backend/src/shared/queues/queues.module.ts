import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Registers the outbox-driven queues ONCE and re-exports BullModule, so both the
 * producer (OutboxPoller, API) and the consumer (MailHandler, workers) share a
 * single registration instead of each calling registerQueue for the same name.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.MAIL })],
  exports: [BullModule],
})
export class QueuesModule {}
