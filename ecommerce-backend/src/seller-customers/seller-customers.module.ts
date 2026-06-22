import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { SellerCustomersController } from './seller-customers.controller';
import { SellerCustomersService } from './seller-customers.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  controllers: [SellerCustomersController],
  providers: [SellerCustomersService],
  exports: [SellerCustomersService],
})
export class SellerCustomersModule {}
