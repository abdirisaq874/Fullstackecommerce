import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventBusService } from './events/event-bus.service';
import { EventPublisherService } from './events/event-publisher.service';
import { DomainEvent, DomainEventSchema } from './events/domain-event.schema';
import { RedisService } from './database/redis.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DomainEvent.name, schema: DomainEventSchema },
    ]),
  ],
  providers: [EventBusService, EventPublisherService, RedisService],
  exports: [EventBusService, RedisService],
})
export class SharedModule {}
