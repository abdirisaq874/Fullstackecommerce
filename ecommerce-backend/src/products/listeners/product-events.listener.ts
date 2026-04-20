import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../schemas/product.schema';

@Injectable()
export class ProductEventsListener {
  private readonly logger = new Logger(ProductEventsListener.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {}

  @OnEvent('order.confirmed')
  async handleOrderConfirmed(payload: { items: { productId: string; quantity: number }[] }) {
    for (const item of payload.items) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: { totalSold: item.quantity },
      });
    }
    this.logger.debug('Updated totalSold for order items');
  }

  @OnEvent('review.approved')
  async handleReviewApproved(payload: { productId: string; avgRating: number; reviewCount: number }) {
    await this.productModel.findByIdAndUpdate(payload.productId, {
      $set: { avgRating: payload.avgRating, reviewCount: payload.reviewCount },
    });
    this.logger.debug(`Updated ratings for product ${payload.productId}`);
  }
}
