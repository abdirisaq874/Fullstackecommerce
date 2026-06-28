import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { Product } from '../products/schemas/product.schema';
import { PaginatedResponseDto } from '../shared/database/pagination.dto';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    @InjectModel(Product.name) private productModel: Model<Product>,
  ) {}

  async list(productId: string, page = 1, limit = 10): Promise<PaginatedResponseDto<ReviewDocument>> {
    const filter = { productId: new Types.ObjectId(productId) };
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const [data, total] = await Promise.all([
      this.reviewModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * safeLimit).limit(safeLimit),
      this.reviewModel.countDocuments(filter),
    ]);
    return new PaginatedResponseDto(data, total, page, safeLimit);
  }

  /** Create or update the caller's review, then recompute the product's rating aggregate. */
  async upsert(productId: string, userId: string, authorName: string, dto: CreateReviewDto): Promise<ReviewDocument> {
    const review = await this.reviewModel.findOneAndUpdate(
      { productId: new Types.ObjectId(productId), userId: new Types.ObjectId(userId) },
      { $set: { rating: dto.rating, title: dto.title, body: dto.body, authorName } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await this.recompute(productId);
    return review;
  }

  private async recompute(productId: string): Promise<void> {
    const [agg] = await this.reviewModel.aggregate([
      { $match: { productId: new Types.ObjectId(productId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await this.productModel.findByIdAndUpdate(productId, {
      $set: {
        avgRating: agg ? Math.round(agg.avg * 10) / 10 : 0,
        reviewCount: agg ? agg.count : 0,
      },
    });
  }
}
