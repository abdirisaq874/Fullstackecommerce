import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('reviews')
@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews for a product' })
  async list(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.list(
      productId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create or update your review for a product' })
  async create(
    @Param('productId') productId: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateReviewDto,
  ) {
    const authorName = `${user.firstName} ${user.lastName}`.trim();
    return this.reviewsService.upsert(productId, user._id.toString(), authorName, dto);
  }
}
