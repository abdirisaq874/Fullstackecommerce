import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import {
  CreateZoneDto, UpdateZoneDto,
  CreateRateDto, UpdateRateDto,
  QuoteDto,
} from './dto/shipping.dto';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ─── Zones ───

  @Get('zones')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: "List the current seller's shipping zones" })
  async listZones(
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.listZones(userId, role);
  }

  @Post('zones')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Create a shipping zone' })
  async createZone(
    @Body() dto: CreateZoneDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.shippingService.createZone(dto, userId);
  }

  @Patch('zones/:id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Update a shipping zone' })
  async updateZone(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.updateZone(id, dto, userId, role);
  }

  @Delete('zones/:id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Soft-delete a shipping zone (and its rates)' })
  async deleteZone(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.deleteZone(id, userId, role);
  }

  // ─── Rates ───

  @Get('zones/:zoneId/rates')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'List rates for a shipping zone' })
  async listRates(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.listRates(zoneId, userId, role);
  }

  @Post('zones/:zoneId/rates')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Create a rate within a shipping zone' })
  async createRate(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @Body() dto: CreateRateDto,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.createRate(zoneId, dto, userId, role);
  }

  @Patch('zones/:zoneId/rates/:rateId')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Update a shipping rate' })
  async updateRate(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @Param('rateId', ParseObjectIdPipe) rateId: string,
    @Body() dto: UpdateRateDto,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.updateRate(zoneId, rateId, dto, userId, role);
  }

  @Delete('zones/:zoneId/rates/:rateId')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Soft-delete a shipping rate' })
  async deleteRate(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @Param('rateId', ParseObjectIdPipe) rateId: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.deleteRate(zoneId, rateId, userId, role);
  }

  // ─── Quote (Public) ───

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get shipping rate quote for a destination & cart items (public)' })
  async quote(@Body() dto: QuoteDto) {
    return this.shippingService.quote(dto);
  }
}
