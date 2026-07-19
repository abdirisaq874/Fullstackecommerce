import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    StoresModule, // provides the Store model
  ],
  controllers: [SellersController],
  providers: [SellersService],
})
export class SellersModule {}
