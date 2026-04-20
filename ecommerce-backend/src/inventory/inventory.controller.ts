import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AdjustStockDto {
  @ApiProperty() @IsString() variantSku: string;
  @ApiProperty() @IsNumber() quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('product/:productId')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Get stock levels for a product' })
  async getStockLevels(@Param('productId', ParseObjectIdPipe) productId: string) {
    return this.inventoryService.getStockLevels(productId);
  }

  @Get('check/:sku')
  @ApiOperation({ summary: 'Check available stock for a SKU' })
  async checkStock(@Param('sku') sku: string) {
    const available = await this.inventoryService.checkStock(sku);
    return { sku, available };
  }

  @Post('adjust')
  @Auth('admin')
  @ApiOperation({ summary: 'Manually adjust stock levels' })
  async adjust(
    @Body() dto: AdjustStockDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.inventoryService.adjust(
      dto.variantSku, dto.quantity, dto.notes || '', userId,
    );
  }
}
