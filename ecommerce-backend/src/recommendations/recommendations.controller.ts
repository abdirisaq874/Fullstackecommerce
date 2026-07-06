import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';

const OID = /^[a-f0-9]{24}$/i;
const clamp = (v: string | undefined, def: number, max = 24) => {
  const n = parseInt(v || '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

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
  @ApiOperation({ summary: 'Personalized recommendations from recently-viewed + trending' })
  forYou(@Query('viewed') viewed?: string, @Query('limit') limit?: string) {
    const ids = (viewed || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => OID.test(s))
      .slice(0, 50);
    return this.svc.forYou(undefined, ids, clamp(limit, 12));
  }
}
