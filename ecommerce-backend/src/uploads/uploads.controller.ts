import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/guards/auth.guards';
import { UploadsService } from './uploads.service';
import { SignedUrlRequestDto } from './dto/signed-url-request.dto';
import { SignedUrlResponseDto } from './dto/signed-url-response.dto';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // TODO: wire to S3 / Cloudinary
  @Post('signed-url')
  @Auth('seller', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a pre-signed URL for direct browser→CDN upload',
    description:
      'Validates the requested upload (allow-listed image MIME, < 10MB) and returns a short-lived signed URL. Stubbed today — production will hand back an S3/Cloudinary signed payload.',
  })
  @ApiResponse({ status: 200, description: 'Signed URL issued', type: SignedUrlResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid contentType' })
  @ApiResponse({ status: 413, description: 'File exceeds 10MB limit' })
  async createSignedUrl(@Body() dto: SignedUrlRequestDto): Promise<SignedUrlResponseDto> {
    return this.uploadsService.createSignedUrl(dto);
  }
}
