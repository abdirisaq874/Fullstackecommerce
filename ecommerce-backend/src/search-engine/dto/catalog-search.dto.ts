import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../shared/database/pagination.dto';

export class CatalogSearchQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Free-text query (any supported language)' })
  @IsOptional() @IsString() q?: string;

  @ApiPropertyOptional({ description: 'UI locale, e.g. en | so', default: 'en' })
  @IsOptional() @IsString() locale?: string;

  @ApiPropertyOptional({ description: 'Category slug' })
  @IsOptional() @IsString() category?: string;

  @ApiPropertyOptional({ description: 'Brand slug' })
  @IsOptional() @IsString() brand?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMin?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMax?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) rating?: number;

  @ApiPropertyOptional({
    description: 'Attribute filters, repeatable: attr=color:red&attr=storage:128GB',
  })
  @IsOptional()
  attr?: string | string[];

  @ApiPropertyOptional({
    description: 'Sort: relevance (default) | price_asc | price_desc | newest | rating | popular',
  })
  @IsOptional() @IsString() sort?: string;
}

export interface CatalogSearchResult {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  price: number;
  currency: string;
  avgRating: number;
  totalSold: number;
  isFeatured: boolean;
  categoryId?: string;
  brandId?: string;
  imageUrl?: string;
}
