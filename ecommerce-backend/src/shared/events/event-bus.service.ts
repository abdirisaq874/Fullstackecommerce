import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, ClientSession } from 'mongoose';
import { DomainEvent } from './domain-event.schema';
import { Types } from 'mongoose';

export interface EmitOptions {
  /** Use MongoDB session for transactional outbox */
  session?: ClientSession;
  /** Aggregate info for the event store */
  aggregateType?: string;
  aggregateId?: string | Types.ObjectId;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @InjectModel(DomainEvent.name) private eventModel: Model<DomainEvent>,
    @InjectConnection() private connection: Connection,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Emit an event. If a session is provided, writes to the outbox
   * in the same transaction (for guaranteed delivery).
   * Otherwise, emits directly via EventEmitter2.
   */
  async emit(
    eventType: string,
    payload: Record<string, any>,
    options?: EmitOptions,
  ): Promise<void> {
    if (options?.session) {
      // Transactional outbox: store event in DB, published later
      await this.eventModel.create(
        [
          {
            eventType,
            aggregateType: options.aggregateType || eventType.split('.')[0],
            aggregateId: options.aggregateId
              ? new Types.ObjectId(options.aggregateId.toString())
              : undefined,
            payload,
            published: false,
          },
        ],
        { session: options.session },
      );
    } else {
      // Direct emit (fire and forget)
      this.eventEmitter.emit(eventType, payload);
      this.logger.debug(`Event emitted: ${eventType}`);

      // Also store for audit
      await this.eventModel.create({
        eventType,
        aggregateType: options?.aggregateType || eventType.split('.')[0],
        aggregateId: options?.aggregateId
          ? new Types.ObjectId(options.aggregateId.toString())
          : undefined,
        payload,
        published: true,
        publishedAt: new Date(),
      });
    }
  }

  /**
   * Start a MongoDB session for transactional operations.
   * Use with the outbox pattern.
   */
  async startSession(): Promise<ClientSession> {
    return this.connection.startSession();
  }
}
