// ─── admin.module.ts ───
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { OrderModule } from '../orders/order.module';
import { ProductModule } from '../products/product.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: User.name, schema: UserSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
    OrderModule,
    ProductModule,
    StoresModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
