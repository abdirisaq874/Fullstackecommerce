import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { StoresModule } from '../stores/stores.module';
import { SellerCustomersController } from './seller-customers.controller';
import { SellerCustomersService } from './seller-customers.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    StoresModule,
  ],
  controllers: [SellerCustomersController],
  providers: [SellerCustomersService],
  exports: [SellerCustomersService],
})
export class SellerCustomersModule {}
