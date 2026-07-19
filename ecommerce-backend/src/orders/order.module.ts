import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderOwnershipGuard } from './guards/order-ownership.guard';
import { OrderEventsListener } from './listeners/order-events.listener';
import { Order, OrderSchema, OrderStatusHistory, OrderStatusHistorySchema } from './schemas/order.schema';
import { CartModule } from '../cart/cart.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderStatusHistory.name, schema: OrderStatusHistorySchema },
    ]),
    CartModule,
    StoresModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderOwnershipGuard, OrderEventsListener],
  exports: [OrderService],
})
export class OrderModule {}
