import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductController, CategoryController, BrandController } from './product.controller';
import { ProductService } from './product.service';
import { ProductEventsListener } from './listeners/product-events.listener';
import {
  Product, ProductSchema, Category, CategorySchema, Brand, BrandSchema,
} from './schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Brand.name, schema: BrandSchema },
    ]),
  ],
  controllers: [ProductController, CategoryController, BrandController],
  providers: [ProductService, ProductEventsListener],
  exports: [ProductService],
})
export class ProductModule {}
