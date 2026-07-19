import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';
import { UpdateSellerSettingsDto } from './dto/seller-settings.dto';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';

// Settings are now per active store (keyed by store id). Store profile fields
// also live on the Store doc (edited via PATCH /stores/:id); these cover the
// operational settings (payouts/tax/notifications/shipping defaults).
@ApiTags('seller-settings')
@ApiBearerAuth()
@Controller('seller/me/settings')
export class SellerSettingsController {
  constructor(private readonly sellerSettingsService: SellerSettingsService) {}

  @Get('/')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Get the active store’s settings (create-on-first-read)' })
  @ApiResponse({ status: 200, description: 'Store settings document.' })
  async getSettings(@ActiveStore('storeId') storeId: string) {
    return this.sellerSettingsService.findOrCreateForUser(storeId);
  }

  @Put('/')
  @StoreScoped(StoreRole.MANAGER)
  @ApiOperation({ summary: 'Update the active store’s settings (manager+)' })
  @ApiResponse({ status: 200, description: 'Updated store settings document.' })
  async updateSettings(
    @ActiveStore('storeId') storeId: string,
    @Body() dto: UpdateSellerSettingsDto,
  ) {
    return this.sellerSettingsService.update(storeId, dto);
  }
}
