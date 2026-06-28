import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import redisConfig from './config/redis.config';
import stripeConfig from './config/stripe.config';
import mailConfig from './config/mail.config';
import searchConfig from './config/search.config';

import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/user.module';
import { ProductModule } from './products/product.module';
import { InventoryModule } from './inventory/inventory.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './orders/order.module';
import { PaymentModule } from './payments/payment.module';
import { NotificationModule } from './notifications/notification.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { SellerSettingsModule } from './seller-settings/seller-settings.module';
import { SellerCustomersModule } from './seller-customers/seller-customers.module';
import { ShippingModule } from './shipping/shipping.module';
import { SellerFinanceModule } from './seller-finance/seller-finance.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReturnsModule } from './returns/returns.module';
import { MessagesModule } from './messages/messages.module';
import { CouponModule } from './coupons/coupon.module';
import { SearchModule } from './search/search.module';
import { SearchEngineModule } from './search-engine/search-engine.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    // ═══ Configuration ═══
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, redisConfig, stripeConfig, mailConfig, searchConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // ═══ Database ═══
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('database.uri'),
        dbName: config.get<string>('database.dbName'),
      }),
      inject: [ConfigService],
    }),

    // ═══ Rate Limiting ═══
    ThrottlerModule.forRootAsync({
      useFactory: (config: ConfigService) => ([{
        ttl: (config.get<number>('app.throttle.ttl') || 60) * 1000,
        limit: config.get<number>('app.throttle.limit') || 100,
      }]),
      inject: [ConfigService],
    }),

    // ═══ Event Bus (internal, swappable for Kafka later) ═══
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),

    // ═══ Background Jobs ═══
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
      inject: [ConfigService],
    }),

    // ═══ Cron/Scheduled Tasks ═══
    ScheduleModule.forRoot(),

    // ═══ Feature Modules ═══
    SharedModule,
    AuthModule,
    UserModule,
    ProductModule,
    InventoryModule,
    CartModule,
    OrderModule,
    PaymentModule,
    NotificationModule,
    AdminModule,
    HealthModule,
    SellerSettingsModule,
    SellerCustomersModule,
    ShippingModule,
    SellerFinanceModule,
    UploadsModule,
    ReturnsModule,
    MessagesModule,
    CouponModule,
    SearchModule,
    SearchEngineModule,
    ReviewsModule,
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
