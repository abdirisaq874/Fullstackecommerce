import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SellersService } from './sellers.service';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Public seller storefront profile (by slug or id)' })
  getProfile(@Param('id') id: string) {
    return this.sellers.getProfile(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: "A seller's active products (paginated)" })
  getProducts(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.sellers.getProducts(id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy,
    });
  }
}
