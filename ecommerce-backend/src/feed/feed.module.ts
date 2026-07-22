import { Module } from '@nestjs/common';
import { ProductModule } from '../products/product.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

// Marketing/catalog feeds for external ad platforms (Meta Commerce, Google
// Merchant). Reuses ProductService from ProductModule for the product query.
@Module({
  imports: [ProductModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
