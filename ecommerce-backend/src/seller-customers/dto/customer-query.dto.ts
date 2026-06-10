import { IsOptional, IsInt, Min, Max, IsString, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const CUSTOMER_SORT_FIELDS = ['lastOrderAt', 'lifetimeValue', 'orderCount'] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export class CustomerQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Free-text search across firstName, lastName, email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    enum: CUSTOMER_SORT_FIELDS,
    default: 'lastOrderAt',
  })
  @IsOptional()
  @IsIn(CUSTOMER_SORT_FIELDS as unknown as string[])
  sortBy: CustomerSortField = 'lastOrderAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
