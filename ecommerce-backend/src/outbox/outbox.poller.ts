import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { OutboxEvent, OutboxEventDocument } from './schemas/outbox-event.schema';
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  sanitizeJobId,
  QueueName,
} from '../shared/queues/queue.constants';
import { targetQueuesFor } from './outbox-routing';
import { EventJobData } from '../shared/events/domain-event';

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 50);
const STUCK_MS = 5 * 60 * 1000;

/**
 * Drains `outbox_events` and fans each row out to its target BullMQ queues.
 * Runs ONLY in the API process (registered via OutboxModule.forRoot({poller:true}));
 * the workers process must not run it or events would be published twice.
 */
@Injectable()
export class OutboxPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPoller.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;
  private readonly queues: Partial<Record<QueueName, Queue>>;

  constructor(
    @InjectModel(OutboxEvent.name) private readonly model: Model<OutboxEventDocument>,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue,
  ) {
    this.queues = { [QUEUE_NAMES.MAIL]: mailQueue };
  }

  onModuleInit(): void {
    this.schedule();
    this.logger.log(`outbox poller started (interval=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE})`);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick().finally(() => this.schedule());
    }, POLL_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sweepStuck();
      let n = 0;
      let row = await this.claimOne();
      while (row && n < BATCH_SIZE) {
        await this.publishOne(row);
        row = await this.claimOne();
        n += 1;
      }
    } catch (e) {
      this.logger.error(`outbox tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Reset rows stuck in 'processing' (a poller crashed mid-publish). */
  private async sweepStuck(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_MS);
    await this.model.updateMany(
      { status: 'processing', lockedAt: { $lt: cutoff } },
      { $set: { status: 'pending' } },
    );
  }

  /** Atomically claim the oldest pending row (safe across concurrent pollers). */
  private async claimOne(): Promise<OutboxEventDocument | null> {
    return this.model.findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'processing', lockedAt: new Date() }, $inc: { attemptCount: 1 } },
      { sort: { occurredAt: 1 }, new: true },
    );
  }

  private async publishOne(row: OutboxEventDocument): Promise<void> {
    const targets = targetQueuesFor(row.eventType);
    try {
      if (targets.length) {
        const jobData: EventJobData = {
          eventType: row.eventType,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          payload: row.payload ?? {},
          occurredAt: row.occurredAt.toISOString(),
          correlationId: row.correlationId,
          outboxEventId: row._id.toString(),
          idempotencyKey: row.idempotencyKey,
        };
        const jobId = sanitizeJobId(row.idempotencyKey);
        await Promise.all(
          targets.map((q) =>
            this.queues[q]?.add(row.eventType, jobData, { ...DEFAULT_JOB_OPTIONS, jobId }),
          ),
        );
      }
      row.status = 'published';
      await row.save();
    } catch (e) {
      row.status = 'pending';
      row.lastError = (e as Error).message;
      await row.save();
      this.logger.warn(`outbox publish failed for ${row.idempotencyKey}: ${(e as Error).message}`);
    }
  }
}
