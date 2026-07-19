import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNotEmpty, MaxLength, MinLength, Matches, IsEmail, IsEnum,
} from 'class-validator';
import { StoreRole } from '../schemas/store-membership.schema';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateStoreDto {
  @ApiProperty({ example: 'Mohamud Electronics' })
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(80)
  displayName: string;

  @ApiPropertyOptional({ description: 'URL slug; generated from name if omitted' })
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters, numbers and single hyphens' })
  slug?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters, numbers and single hyphens' })
  slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() supportEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) supportPhone?: string;
}

export class AddMemberDto {
  @ApiProperty({ description: 'Email of an existing user to add as staff' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: [StoreRole.MANAGER, StoreRole.STAFF], default: StoreRole.STAFF })
  @IsEnum([StoreRole.MANAGER, StoreRole.STAFF], { message: 'role must be manager or staff' })
  role: StoreRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: [StoreRole.MANAGER, StoreRole.STAFF] })
  @IsEnum([StoreRole.MANAGER, StoreRole.STAFF], { message: 'role must be manager or staff' })
  role: StoreRole;
}
