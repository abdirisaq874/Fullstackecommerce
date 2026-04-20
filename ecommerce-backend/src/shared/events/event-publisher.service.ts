import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DomainEvent } from './domain-event.schema';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(DomainEvent.name) private eventModel: Model<DomainEvent>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Poll for unpublished events every second.
   * In production, swap this for a Kafka/RabbitMQ producer.
   */
  @Cron(CronExpression.EVERY_SECOND)
  async publishPendingEvents(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const events = await this.eventModel
        .find({
          published: false,
          retryCount: { $lt: 5 },
        })
        .sort({ createdAt: 1 })
        .limit(50);

      for (const event of events) {
        try {
          this.eventEmitter.emit(event.eventType, event.payload);

          await this.eventModel.updateOne(
            { _id: event._id },
            {
              $set: { published: true, publishedAt: new Date() },
            },
          );

          this.logger.debug(`Published: ${event.eventType} (${event._id})`);
        } catch (error: any) {
          this.logger.error(
            `Failed to publish ${event.eventType}: ${error.message}`,
          );
          await this.eventModel.updateOne(
            { _id: event._id },
            {
              $inc: { retryCount: 1 },
              $set: { error: error.message },
            },
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
