import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogSearchQueryDto } from './dto/catalog-search.dto';
import { CatalogSearchService, CatalogSearchResponse } from './search.service';

/**
 * Customer-facing smart search. Public (no auth), rate-limited by the global
 * throttler. Distinct from the auth'd seller command-palette at /search.
 */
@ApiTags('catalog-search')
@Controller('catalog')
export class CatalogSearchController {
  constructor(private readonly searchService: CatalogSearchService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Smart multilingual product search (hybrid + rerank + dynamic facets)',
  })
  async search(@Query() dto: CatalogSearchQueryDto): Promise<CatalogSearchResponse> {
    return this.searchService.search({
      q: dto.q,
      locale: dto.locale || 'en',
      page: dto.page,
      limit: dto.limit,
      sort: dto.sort,
      filters: {
        categorySlug: dto.category,
        brandSlug: dto.brand,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        rating: dto.rating,
        attributes: this.parseAttrs(dto.attr),
      },
    });
  }

  /** `attr=color:red&attr=storage:128GB` → [{key:'color',value:'red'}, …] */
  private parseAttrs(attr?: string | string[]): { key: string; value: string }[] {
    if (!attr) return [];
    const list = Array.isArray(attr) ? attr : [attr];
    return list
      .map((s) => {
        const i = s.indexOf(':');
        return i > 0 ? { key: s.slice(0, i), value: s.slice(i + 1) } : null;
      })
      .filter((x): x is { key: string; value: string } => x !== null);
  }
}
