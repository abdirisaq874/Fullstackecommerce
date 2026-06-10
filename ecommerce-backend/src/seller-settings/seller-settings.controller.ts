import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SellerSettingsService } from './seller-settings.service';
import { UpdateSellerSettingsDto } from './dto/seller-settings.dto';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from '../auth/guards/auth.guards';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('seller-settings')
@ApiBearerAuth()
@Controller('seller/me/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class SellerSettingsController {
  constructor(private readonly sellerSettingsService: SellerSettingsService) {}

  @Get('/')
  @ApiOperation({
    summary: 'Get current seller settings (create-on-first-read with defaults)',
  })
  @ApiResponse({ status: 200, description: 'Seller settings document.' })
  async getSettings(@CurrentUser('_id') userId: string) {
    return this.sellerSettingsService.findOrCreateForUser(userId);
  }

  @Put('/')
  @ApiOperation({ summary: 'Update current seller settings (full update via $set)' })
  @ApiResponse({ status: 200, description: 'Updated seller settings document.' })
  async updateSettings(
    @CurrentUser('_id') userId: string,
    @Body() dto: UpdateSellerSettingsDto,
  ) {
    return this.sellerSettingsService.update(userId, dto);
  }
}
