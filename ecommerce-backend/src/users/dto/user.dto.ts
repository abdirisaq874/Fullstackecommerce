import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsBoolean,
  IsEmail,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
}

export class CreateAddressDto {
  @ApiPropertyOptional({ enum: ['shipping', 'billing'] })
  @IsOptional() @IsEnum(['shipping', 'billing'])
  type?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiProperty() @IsString() fullName: string;
  @ApiProperty() @IsString() line1: string;
  @ApiPropertyOptional() @IsOptional() @IsString() line2?: string;
  @ApiProperty() @IsString() city: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiProperty() @IsString() postalCode: string;
  @ApiProperty() @IsString() @MaxLength(2) countryCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}
