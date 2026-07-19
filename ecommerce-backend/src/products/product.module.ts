import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ProductController, CategoryController, BrandController } from './product.controller';
import { ProductService } from './product.service';
import { ProductAiService } from './product-ai.service';
import { ProductEventsListener } from './listeners/product-events.listener';
import { ProductImportController } from './import/product-import.controller';
import { ProductImportService } from './import/product-import.service';
import { ProductImportProcessor } from './import/product-import.processor';
import { PRODUCT_IMPORT_QUEUE } from './import/product-import.constants';
import { ImportJob, ImportJobSchema } from './schemas/import-job.schema';
import {
  Product, ProductSchema, Category, CategorySchema, Brand, BrandSchema,
} from './schemas/product.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Brand.name, schema: BrandSchema },
      { name: ImportJob.name, schema: ImportJobSchema },
    ]),
    BullModule.registerQueue({ name: PRODUCT_IMPORT_QUEUE }),
    UploadsModule,
    StoresModule,
  ],
  // ProductImportController first so its specific /products/import* and
  // /products/imports routes match before ProductController's `:idOrSlug` catch-all.
  controllers: [ProductImportController, ProductController, CategoryController, BrandController],
  providers: [
    ProductService,
    ProductAiService,
    ProductEventsListener,
    ProductImportService,
    ProductImportProcessor,
  ],
  exports: [ProductService],
})
export class ProductModule {}
