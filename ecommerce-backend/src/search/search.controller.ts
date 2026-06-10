import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard, CurrentUser } from '../auth/guards/auth.guards';
import {
  SearchResponse,
  SearchService,
  SearchType,
} from './search.service';

const VALID_TYPES: ReadonlyArray<SearchType> = ['all', 'product', 'order', 'message'];

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/')
  @ApiOperation({
    summary: 'Thin cross-entity search for the seller command palette',
  })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'type', required: false, enum: VALID_TYPES as SearchType[] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async search(
    @CurrentUser('_id') sellerId: string,
    @Query('q') q: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResponse> {
    const safeType: SearchType =
      type && (VALID_TYPES as string[]).includes(type)
        ? (type as SearchType)
        : 'all';

    const parsedLimit = limit !== undefined ? Number.parseInt(limit, 10) : 10;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;

    return this.searchService.search(sellerId, q ?? '', safeType, safeLimit);
  }
}
