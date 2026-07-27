import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';
import { RecommendationsService } from './recommendations.service';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { OptionalAuth, CurrentUser } from '../auth/guards/auth.guards';

const OID = /^[a-f0-9]{24}$/i;
const clamp = (v: string | undefined, def: number, max = 24) => {
  const n = parseInt(v || '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

class TrackDto {
  @ApiProperty() @IsMongoId() productId: string;
  @ApiProperty({ enum: ['view', 'cart', 'purchase'] })
  @IsIn(['view', 'cart', 'purchase'])
  type: 'view' | 'cart' | 'purchase';
}

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Get('related/:productId')
  @ApiOperation({ summary: 'Similar products (semantic vector k-NN, category fallback)' })
  related(@Param('productId', ParseObjectIdPipe) productId: string, @Query('limit') limit?: string) {
    return this.svc.related(productId, clamp(limit, 8));
  }

  @Get('frequently-bought-together/:productId')
  @ApiOperation({ summary: 'Products frequently bought together (order co-purchase)' })
  fbt(@Param('productId', ParseObjectIdPipe) productId: string, @Query('limit') limit?: string) {
    return this.svc.frequentlyBoughtTogether(productId, clamp(limit, 6));
  }

  @Get('for-you')
  @OptionalAuth()
  @ApiOperation({ summary: 'Personalized recommendations from the user profile + recently-viewed + trending' })
  forYou(
    @CurrentUser('_id') userId: string | undefined,
    @Query('viewed') viewed?: string,
    @Query('limit') limit?: string,
  ) {
    const ids = (viewed || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => OID.test(s))
      .slice(0, 50);
    return this.svc.forYou(userId, ids, clamp(limit, 12));
  }

  @Post('track')
  @OptionalAuth()
  @ApiOperation({ summary: 'Record a behavioural signal (view/cart/purchase) for a logged-in user' })
  async track(@CurrentUser('_id') userId: string | undefined, @Body() dto: TrackDto) {
    await this.svc.recordInteraction(userId, dto.productId, dto.type);
    return { ok: true };
  }
}
