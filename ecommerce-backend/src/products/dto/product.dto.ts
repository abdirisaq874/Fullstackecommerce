import {
  IsString, IsNumber, IsOptional, IsEnum, IsBoolean,
  IsArray, ArrayNotEmpty, IsMongoId, ValidateNested, Min, MaxLength, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../shared/database/pagination.dto';

export class VariantOptionDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() value: string;
}

export class CreateVariantDto {
  @ApiProperty() @IsString() sku: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() priceOverride?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() costPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() weightGrams?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() barcode?: string;
  // Per-variant stock. Not stored on the variant sub-doc — persisted to the
  // Inventory collection (per-SKU) via the product.stock_set event.
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) stock?: number;

  @ApiPropertyOptional({ type: [VariantOptionDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  options?: VariantOptionDto[];
}

export class CreateImageDto {
  @ApiProperty() @IsString() url: string;
  @ApiPropertyOptional() @IsOptional() @IsString() altText?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
  // Structured variant-image association: this image applies to variants whose
  // options include EVERY {name,value} here (e.g. [{Color,White}] or
  // [{Material,Cotton},{Sleeve,Long}]). Empty/absent = a shared/general image.
  @ApiPropertyOptional({ type: [VariantOptionDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  appliesTo?: VariantOptionDto[];
}

export class AttributeDto {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() value: string;
}

// Buyer-facing text for a single locale. All optional — empty fields fall back
// to the canonical English (the top-level name/shortDescription/description).
export class LocalizedTextDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

// Per-locale translations (en / tr / so / sw / am) — matches the seller-portal
// LocalizedFields shape. English is canonical; the rest are optional overrides.
export class ProductLocalizationsDto {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) en?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) tr?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) so?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) sw?: LocalizedTextDto;

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional() @ValidateNested() @Type(() => LocalizedTextDto) am?: LocalizedTextDto;
}

export class CreateProductDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brandId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];

  @ApiProperty() @IsNumber() @Min(0) basePrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) compareAtPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) stock?: number;
  @ApiPropertyOptional({ enum: ['draft', 'active', 'archived'] })
  @IsOptional() @IsEnum(['draft', 'active', 'archived'])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;

  @ApiPropertyOptional({ type: [CreateVariantDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @ApiPropertyOptional({ type: [CreateImageDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];

  @ApiPropertyOptional({ type: [AttributeDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  attributes?: AttributeDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() metaDescription?: string;

  @ApiPropertyOptional({ type: ProductLocalizationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductLocalizationsDto)
  localizations?: ProductLocalizationsDto;
}

// PATCH = partial update: every field optional, validation/Swagger preserved.
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMin?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) priceMax?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) rating?: number;
  // NOTE: `inStock` filtering removed until availability is denormalized onto the
  // product (via inventory events) or moved to the search index — a per-request
  // lookup into the inventory collection doesn't belong on this hot path.
  @ApiPropertyOptional() @IsOptional() @IsBoolean() featured?: boolean;
  @ApiPropertyOptional({ enum: ['draft', 'active', 'archived'] })
  @IsOptional() @IsEnum(['draft', 'active', 'archived'])
  status?: string;

  // Scope results to a single seller (seller-portal "my products" list, and
  // public per-seller storefronts).
  @ApiPropertyOptional() @IsOptional() @IsString() sellerId?: string;
}

export class CreateCategoryDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateBrandDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

// Fields safe to change across many products at once (Publish / Archive / Feature).
export class BulkProductPatchDto {
  @ApiPropertyOptional({ enum: ['draft', 'active', 'archived'] })
  @IsOptional() @IsEnum(['draft', 'active', 'archived'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isFeatured?: boolean;
}

export class BulkUpdateProductsDto {
  @ApiProperty({ type: [String], description: 'Product ids to update' })
  @IsArray() @ArrayNotEmpty() @IsMongoId({ each: true })
  ids: string[];

  @ApiProperty({ type: BulkProductPatchDto })
  @ValidateNested() @Type(() => BulkProductPatchDto)
  patch: BulkProductPatchDto;
}

// Create many products in one request (CSV bulk import). Keeps the import to a
// few requests instead of one-per-row, staying under the global rate limit.
export class BulkCreateProductsDto {
  @ApiProperty({ type: [CreateProductDto], description: 'Products to create' })
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => CreateProductDto)
  products: CreateProductDto[];
}
