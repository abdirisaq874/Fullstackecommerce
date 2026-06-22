import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignedUrlResponseDto {
  @ApiProperty({
    description: 'Pre-signed URL the browser PUTs/POSTs the file to.',
    example: 'https://storage.example.com/uploads/abc-123?signature=stub',
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'Public CDN URL where the uploaded asset will be served from.',
    example: 'https://cdn.example.com/abc-123/photo.png',
  })
  publicUrl: string;

  @ApiPropertyOptional({
    description: 'Optional form fields the client must include when posting (e.g. S3 POST policy).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  fields?: Record<string, string>;

  @ApiProperty({
    description: 'ISO timestamp after which the upload URL is no longer valid.',
    example: '2026-06-10T12:15:00.000Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'Maximum payload size in bytes the signed URL accepts.',
    example: 10 * 1024 * 1024,
  })
  maxBytes: number;
}
