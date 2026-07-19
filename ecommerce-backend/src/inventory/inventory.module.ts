import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryEventsListener } from './listeners/inventory-events.listener';
import {
  Inventory, InventorySchema,
  InventoryMovement, InventoryMovementSchema,
  Warehouse, WarehouseSchema,
} from './schemas/inventory.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inventory.name, schema: InventorySchema },
      { name: InventoryMovement.name, schema: InventoryMovementSchema },
      { name: Warehouse.name, schema: WarehouseSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    StoresModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryEventsListener],
  exports: [InventoryService],
})
export class InventoryModule {}
