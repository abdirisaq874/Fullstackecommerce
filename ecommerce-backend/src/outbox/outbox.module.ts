import { DynamicModule, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxEvent, OutboxEventSchema } from './schemas/outbox-event.schema';
import { OutboxService } from './outbox.service';
import { OutboxPoller } from './outbox.poller';
import { QueuesModule } from '../shared/queues/queues.module';

/**
 * Global so any feature service can inject OutboxService without importing this
 * module. `forRoot({ poller })` adds the drainer — enable it in the API process,
 * disable it in the workers process (consumers run there; running the poller in
 * both would double-publish).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: OutboxEvent.name, schema: OutboxEventSchema }]),
    QueuesModule,
  ],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {
  static forRoot(opts: { poller: boolean }): DynamicModule {
    return {
      module: OutboxModule,
      providers: opts.poller ? [OutboxPoller] : [],
    };
  }
}
