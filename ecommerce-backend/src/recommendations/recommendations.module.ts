import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { UserInteraction, UserInteractionSchema } from './schemas/user-interaction.schema';
import { SearchEngineModule } from '../search-engine/search-engine.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsListener } from './listeners/recommendations.listener';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: UserInteraction.name, schema: UserInteractionSchema },
    ]),
    SearchEngineModule,
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationsListener],
})
export class RecommendationsModule {}
