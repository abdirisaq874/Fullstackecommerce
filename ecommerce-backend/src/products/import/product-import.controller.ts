import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Auth, CurrentUser } from '../../auth/guards/auth.guards';
import { ProductImportService } from './product-import.service';

const MAX_IMPORT_BYTES = 25 * 1024 * 1024; // 25MB

@ApiTags('products')
@Controller('products')
export class ProductImportController {
  constructor(private readonly importService: ProductImportService) {}

  @Post('import')
  @Auth('admin', 'seller')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk-import products from a CSV/XLSX file (async job)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES } }))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('_id') userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (form field "file").');
    return this.importService.parseAndEnqueue(
      { buffer: file.buffer, originalname: file.originalname },
      userId,
    );
  }

  @Get('imports')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'List my recent bulk-import jobs' })
  async list(@CurrentUser('_id') userId: string) {
    return this.importService.listJobs(userId);
  }

  @Get('import/:jobId')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Get bulk-import job progress' })
  async status(@Param('jobId') jobId: string, @CurrentUser('_id') userId: string) {
    return this.importService.getJob(jobId, userId);
  }

  @Post('import/:jobId/retry')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Re-run the failed items of a prior import as a new job' })
  async retry(@Param('jobId') jobId: string, @CurrentUser('_id') userId: string) {
    return this.importService.retryFailed(jobId, userId);
  }
}
