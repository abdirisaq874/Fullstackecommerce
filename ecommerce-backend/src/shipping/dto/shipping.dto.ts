import {
  IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsNotEmpty,
  ValidateNested, Min, Length, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ─── Zone DTOs ───
export class CreateZoneDto {
  @ApiProperty({ example: 'North America' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [String], example: ['US', 'CA', 'MX'] })
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  countries: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional() @IsNumber() @Min(0)
  leadTimeDays?: number;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

// ─── Rate DTOs ───
export class CreateRateDto {
  @ApiProperty({ example: 'standard' })
  @IsString() @IsNotEmpty()
  method: string;

  @ApiProperty({ example: 500 })
  @IsNumber() @Min(0)
  baseCostCents: number;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  perItemCostCents?: number;

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  perKgCostCents?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional() @IsNumber() @Min(0)
  minDeliveryDays?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional() @IsNumber() @Min(0)
  maxDeliveryDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateRateDto extends PartialType(CreateRateDto) {}

// ─── Quote DTOs ───
export class QuoteItemDto {
  @ApiProperty({ example: 'SKU-123' })
  @IsString() @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 2 })
  @IsNumber() @Min(1)
  qty: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional() @IsNumber() @Min(0)
  weightGrams?: number;
}

export class QuoteDto {
  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsString() @Length(2, 2)
  destinationCountry: string;

  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray() @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}
