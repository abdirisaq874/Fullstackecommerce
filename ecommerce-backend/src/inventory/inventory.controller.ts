import { Controller, Get, Post, Param, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { StoresService } from '../stores/stores.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AdjustStockDto {
  @ApiProperty() @IsString() variantSku: string;
  @ApiProperty() @IsNumber() quantity: number;
  // Which listing's stock to adjust — supplier SKUs aren't seller-unique, so a SKU
  // alone can be ambiguous. Optional for back-compat with single-listing SKUs.
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly storesService: StoresService,
  ) {}

  @Get('product/:productId')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Get stock levels for a product' })
  async getStockLevels(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('_id') userId: string,
    @Headers('x-store-id') storeHeader?: string,
  ) {
    // Sellers may only read stock for products in their active store; admins are global.
    let storeId: string | undefined;
    if (role !== 'admin') {
      storeId = (await this.storesService.resolveActiveStore(userId, storeHeader?.trim() || undefined)).storeId;
    }
    return this.inventoryService.getStockLevels(productId, storeId);
  }

  @Get('check/:sku')
  @ApiOperation({ summary: 'Check available stock for a SKU' })
  async checkStock(@Param('sku') sku: string) {
    const available = await this.inventoryService.checkStock(sku);
    return { sku, available };
  }

  // Public, unauthenticated per-variant stock for the storefront PDP. Unlike the
  // seller-scoped `product/:productId` route above, this is read-only and exposes
  // only variantSku/quantity/reserved so the PDP can show real per-combination
  // availability (incl. 0). Untracked SKUs simply won't appear → the client falls
  // back to the product-level stock for those.
  @Get('public/product/:productId')
  @ApiOperation({ summary: 'Public per-variant stock for a product (storefront PDP)' })
  async publicStockLevels(@Param('productId', ParseObjectIdPipe) productId: string) {
    const levels = await this.inventoryService.getStockLevels(productId);
    return levels.map((l) => ({
      variantSku: l.variantSku,
      quantity: l.quantity,
      reserved: l.reserved,
    }));
  }

  @Post('adjust')
  @Auth('admin')
  @ApiOperation({ summary: 'Manually adjust stock levels' })
  async adjust(
    @Body() dto: AdjustStockDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.inventoryService.adjust(
      dto.variantSku, dto.quantity, dto.notes || '', userId, dto.productId,
    );
  }
}
