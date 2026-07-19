import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';

import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import authConfig from '../config/auth.config';
import redisConfig from '../config/redis.config';
import stripeConfig from '../config/stripe.config';
import mailConfig from '../config/mail.config';
import searchConfig from '../config/search.config';
import translationConfig from '../config/translation.config';

import { OutboxModule } from '../outbox/outbox.module';
import { MailModule } from '../mail/mail.module';

/**
 * Root module for the dedicated WORKERS process (headless, no HTTP). Runs the
 * mail consumer (MailHandler). The outbox POLLER stays in the API process
 * (poller: false here) so events are published exactly once.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, redisConfig, stripeConfig, mailConfig, searchConfig, translationConfig],
      envFilePath: ['.env', '.env.local'],
    }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('database.uri'),
        dbName: config.get<string>('database.dbName'),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),
    OutboxModule.forRoot({ poller: false }),
    MailModule.forWorkers(),
  ],
})
export class WorkersModule {}
