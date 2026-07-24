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
import { StoreScoped, ActiveStore } from '../../stores/guards/store-context.guard';
import { StoreRole } from '../../stores/schemas/store-membership.schema';
import { ProductImportService } from './product-import.service';

const MAX_IMPORT_BYTES = 25 * 1024 * 1024; // 25MB

@ApiTags('products')
@Controller('products')
export class ProductImportController {
  constructor(private readonly importService: ProductImportService) {}

  @Post('import')
  @StoreScoped(StoreRole.STAFF)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk-import products into the active store (async job)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES } }))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @ActiveStore('storeId') storeId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded (form field "file").');
    return this.importService.parseAndEnqueue(
      { buffer: file.buffer, originalname: file.originalname },
      storeId,
    );
  }

  @Get('imports')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'List the active store’s recent bulk-import jobs' })
  async list(@ActiveStore('storeId') storeId: string) {
    return this.importService.listJobs(storeId);
  }

  @Get('import/:jobId')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Get bulk-import job progress' })
  async status(@Param('jobId') jobId: string, @ActiveStore('storeId') storeId: string) {
    return this.importService.getJob(jobId, storeId);
  }

  @Post('import/:jobId/retry')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Re-run the failed items of a prior import as a new job' })
  async retry(@Param('jobId') jobId: string, @ActiveStore('storeId') storeId: string) {
    return this.importService.retryFailed(jobId, storeId);
  }

  @Post('import/:jobId/cancel')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Cancel an in-progress bulk-import (skips remaining products)' })
  async cancel(@Param('jobId') jobId: string, @ActiveStore('storeId') storeId: string) {
    return this.importService.cancelJob(jobId, storeId);
  }
}
