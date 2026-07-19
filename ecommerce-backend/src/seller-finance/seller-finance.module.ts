import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SellerFinanceController } from './seller-finance.controller';
import { SellerFinanceService } from './seller-finance.service';
import {
  SellerPayout,
  SellerPayoutSchema,
} from './schemas/seller-payout.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SellerPayout.name, schema: SellerPayoutSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    StoresModule,
  ],
  controllers: [SellerFinanceController],
  providers: [SellerFinanceService],
  exports: [SellerFinanceService],
})
export class SellerFinanceModule {}
