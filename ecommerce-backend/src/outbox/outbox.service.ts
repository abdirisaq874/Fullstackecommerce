import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { OutboxEvent, OutboxEventDocument } from './schemas/outbox-event.schema';
import { DomainEventInput, defaultIdempotencyKey } from '../shared/events/domain-event';

/**
 * Transactional outbox. Publishers call `publish(event, { session })` INSIDE the
 * same Mongo transaction as their state change, so the event and the state
 * commit atomically — no lost or phantom events. A duplicate idempotencyKey
 * (unique index) is swallowed, making publish idempotent.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectModel(OutboxEvent.name) private readonly model: Model<OutboxEventDocument>,
  ) {}

  async publish(event: DomainEventInput, opts: { session?: ClientSession } = {}): Promise<void> {
    const row = {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload ?? {},
      occurredAt: new Date(),
      correlationId: event.correlationId,
      idempotencyKey: defaultIdempotencyKey(event),
      status: 'pending' as const,
    };
    try {
      await this.model.create([row], { session: opts.session });
    } catch (e: unknown) {
      if ((e as { code?: number })?.code === 11000) {
        this.logger.debug(`outbox: duplicate event ${row.idempotencyKey} ignored`);
        return;
      }
      throw e;
    }
  }

  async publishMany(events: DomainEventInput[], opts: { session?: ClientSession } = {}): Promise<void> {
    for (const e of events) await this.publish(e, opts);
  }
}
