import {
  IsString, IsNumber, IsOptional, IsEnum, IsBoolean,
  IsDateString, Min, Max, IsNotEmpty, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../shared/database/pagination.dto';

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique coupon code (case-insensitive, stored upper-case)' })
  @IsString() @IsNotEmpty() @MaxLength(64)
  code: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ['percentage', 'fixed'] })
  @IsEnum(['percentage', 'fixed'])
  discountType: 'percentage' | 'fixed';

  @ApiProperty({ description: 'Percent (0-100) or fixed amount in integer cents' })
  @IsNumber() @Min(0)
  discountValue: number;

  @ApiPropertyOptional({ description: 'Cap on percentage discounts, in integer cents' })
  @IsOptional() @IsNumber() @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ description: 'Minimum order subtotal in integer cents' })
  @IsOptional() @IsNumber() @Min(0)
  minPurchaseAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  currency?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  usageLimit?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  usageLimitPerUser?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class CouponQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
