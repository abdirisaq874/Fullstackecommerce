import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  ProcessedWebhookEvent, ProcessedWebhookEventSchema,
} from './schemas/processed-webhook-event.schema';
import { OrderModule } from '../orders/order.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: ProcessedWebhookEvent.name, schema: ProcessedWebhookEventSchema },
    ]),
    OrderModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
