import { Injectable, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  SignedUrlRequestDto,
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from './dto/signed-url-request.dto';
import { SignedUrlResponseDto } from './dto/signed-url-response.dto';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class UploadsService {
  /**
   * Generate a (stub) pre-signed URL for direct browser → CDN uploads.
   * TODO: wire to S3 / Cloudinary — currently returns deterministic stub URLs
   * so the frontend integration can be wired end-to-end ahead of provider setup.
   */
  async createSignedUrl(dto: SignedUrlRequestDto): Promise<SignedUrlResponseDto> {
    // Validate content type against allow-list.
    if (!ALLOWED_CONTENT_TYPES.includes(dto.contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
      throw new BadRequestException(
        `Unsupported contentType "${dto.contentType}". Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    if (dto.sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be a positive integer');
    }

    if (dto.sizeBytes >= MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `File too large: ${dto.sizeBytes} bytes exceeds limit of ${MAX_UPLOAD_BYTES} bytes (10MB)`,
      );
    }

    const id = randomUUID();
    const safeFileName = encodeURIComponent(dto.fileName);
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();

    return {
      uploadUrl: `https://storage.example.com/uploads/${id}?signature=stub`,
      publicUrl: `https://cdn.example.com/${id}/${safeFileName}`,
      fields: {
        'x-amz-meta-scope': dto.scope ?? 'product',
        'content-type': dto.contentType,
      },
      expiresAt,
      maxBytes: MAX_UPLOAD_BYTES,
    };
  }
}
