import { IsString, IsNumber, IsOptional, IsEnum, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export type UploadScope = 'product' | 'logo' | 'document';

export class SignedUrlRequestDto {
  @ApiProperty({ description: 'Original file name (used in the public URL).' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: 'MIME content type of the upload.',
    enum: ALLOWED_CONTENT_TYPES,
  })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiProperty({
    description: 'Total size of the file in bytes. Must be under 10MB.',
    minimum: 1,
    maximum: MAX_UPLOAD_BYTES,
  })
  @IsNumber()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes: number;

  @ApiPropertyOptional({
    description: 'Logical bucket / folder the asset belongs to.',
    enum: ['product', 'logo', 'document'],
  })
  @IsOptional()
  @IsEnum(['product', 'logo', 'document'])
  scope?: UploadScope;
}
