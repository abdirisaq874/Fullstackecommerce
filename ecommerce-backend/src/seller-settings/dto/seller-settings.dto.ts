import {
  IsString, IsOptional, IsEnum, IsBoolean, IsNumber,
  IsEmail, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class StoreProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ default: 'USD' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() supportEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supportPhone?: string;
}

export class PayoutsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() stripeConnectAccountId?: string;

  @ApiPropertyOptional({ enum: ['stripe', 'bank', 'paypal'] })
  @IsOptional() @IsEnum(['stripe', 'bank', 'paypal'])
  payoutMethod?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() bankAccountLast4?: string;

  @ApiPropertyOptional({ enum: ['weekly', 'biweekly', 'monthly'], default: 'weekly' })
  @IsOptional() @IsEnum(['weekly', 'biweekly', 'monthly'])
  payoutSchedule?: string;
}

export class TaxSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() taxExempt?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) defaultTaxRate?: number;
}

export class NotificationPrefsDto {
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() newOrderEmail?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() lowStockEmail?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() returnRequestEmail?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() messageEmail?: boolean;
}

export class ShippingDefaultsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() defaultZoneId?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() @Min(0) defaultHandlingDays?: number;
}

export class CreateSellerSettingsDto {
  @ApiPropertyOptional({ type: StoreProfileDto })
  @IsOptional() @ValidateNested() @Type(() => StoreProfileDto)
  storeProfile?: StoreProfileDto;

  @ApiPropertyOptional({ type: PayoutsDto })
  @IsOptional() @ValidateNested() @Type(() => PayoutsDto)
  payouts?: PayoutsDto;

  @ApiPropertyOptional({ type: TaxSettingsDto })
  @IsOptional() @ValidateNested() @Type(() => TaxSettingsDto)
  tax?: TaxSettingsDto;

  @ApiPropertyOptional({ type: NotificationPrefsDto })
  @IsOptional() @ValidateNested() @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;

  @ApiPropertyOptional({ type: ShippingDefaultsDto })
  @IsOptional() @ValidateNested() @Type(() => ShippingDefaultsDto)
  shippingDefaults?: ShippingDefaultsDto;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional() @IsString()
  preferredLanguage?: string;
}

export class UpdateSellerSettingsDto extends PartialType(CreateSellerSettingsDto) {}
