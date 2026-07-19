import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  SignedUrlRequestDto,
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  UploadScope,
} from './dto/signed-url-request.dto';
import { SignedUrlResponseDto } from './dto/signed-url-response.dto';

const SIGNED_URL_TTL_SEC = 15 * 60; // 15 minutes

/**
 * Direct browser → Cloudflare R2 uploads via S3-compatible pre-signed PUT URLs.
 * The browser PUTs the file to `uploadUrl`, then the asset is served publicly
 * from `publicUrl` (R2 public bucket URL / custom domain).
 *
 * Falls back to deterministic stub URLs when R2 isn't configured, so local dev
 * and CI still run end-to-end without credentials.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client | null;
  private readonly bucket = process.env.R2_BUCKET || '';
  private readonly publicBase = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (endpoint && this.bucket && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: process.env.R2_REGION || 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`R2 uploads enabled → bucket "${this.bucket}"`);
    } else {
      this.s3 = null;
      this.logger.warn('R2 not configured — /uploads/signed-url returns stub URLs.');
    }
  }

  private validate(dto: SignedUrlRequestDto): void {
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
  }

  async createSignedUrl(dto: SignedUrlRequestDto): Promise<SignedUrlResponseDto> {
    this.validate(dto);

    const id = randomUUID();
    const scope = dto.scope ?? 'product';
    // Keep the key URL-safe so the signed key and the public URL match exactly.
    const safeFileName = (dto.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const key = `${scope}/${id}/${safeFileName}`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString();

    if (!this.s3) {
      // Dev/CI fallback (no R2 configured).
      return {
        uploadUrl: `https://storage.example.com/uploads/${id}?signature=stub`,
        publicUrl: `https://cdn.example.com/${key}`,
        expiresAt,
        maxBytes: MAX_UPLOAD_BYTES,
      };
    }

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: dto.contentType }),
      { expiresIn: SIGNED_URL_TTL_SEC },
    );
    const publicUrl = this.publicBase
      ? `${this.publicBase}/${key}`
      : `${process.env.R2_ENDPOINT}/${this.bucket}/${key}`;

    // No `fields` → the client issues a PUT with the Content-Type header.
    return { uploadUrl, publicUrl, expiresAt, maxBytes: MAX_UPLOAD_BYTES };
  }

  private extFromContentType(ct: string): string {
    if (ct.includes('png')) return 'png';
    if (ct.includes('webp')) return 'webp';
    if (ct.includes('gif')) return 'gif';
    return 'jpg';
  }

  /**
   * Server-side rehost: download a remote image and store it in R2, returning
   * the public URL. Used by bulk import so third-party CDN links are never kept
   * on our products. Falls back to the source URL when R2 isn't configured.
   */
  async putRemoteImage(sourceUrl: string, scope: UploadScope = 'product'): Promise<string> {
    if (!/^https?:\/\//i.test(sourceUrl)) {
      throw new BadRequestException(`Invalid image URL: ${sourceUrl}`);
    }
    if (!this.s3) return sourceUrl; // dev/CI fallback (no R2 configured)

    const res = await fetch(sourceUrl, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new BadRequestException(`Image fetch failed (${res.status})`);

    const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException(`URL is not an image (${contentType})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new BadRequestException('Downloaded image is empty');
    if (buffer.length >= MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(`Image too large: ${buffer.length} bytes`);
    }

    const key = `${scope}/${randomUUID()}/image.${this.extFromContentType(contentType)}`;
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
    return this.publicBase
      ? `${this.publicBase}/${key}`
      : `${process.env.R2_ENDPOINT}/${this.bucket}/${key}`;
  }
}
