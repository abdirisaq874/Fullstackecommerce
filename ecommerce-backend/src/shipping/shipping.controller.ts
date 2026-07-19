import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CurrentUser } from '../auth/guards/auth.guards';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';
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
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: "List the current seller's shipping zones" })
  async listZones(
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.listZones(storeId, role);
  }

  @Post('zones')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Create a shipping zone' })
  async createZone(
    @Body() dto: CreateZoneDto,
    @ActiveStore('storeId') storeId: string,
  ) {
    return this.shippingService.createZone(dto, storeId);
  }

  @Patch('zones/:id')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Update a shipping zone' })
  async updateZone(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateZoneDto,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.updateZone(id, dto, storeId, role);
  }

  @Delete('zones/:id')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Soft-delete a shipping zone (and its rates)' })
  async deleteZone(
    @Param('id', ParseObjectIdPipe) id: string,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.deleteZone(id, storeId, role);
  }

  // ─── Rates ───

  @Get('zones/:zoneId/rates')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'List rates for a shipping zone' })
  async listRates(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.listRates(zoneId, storeId, role);
  }

  @Post('zones/:zoneId/rates')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Create a rate within a shipping zone' })
  async createRate(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @Body() dto: CreateRateDto,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.createRate(zoneId, dto, storeId, role);
  }

  @Patch('zones/:zoneId/rates/:rateId')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Update a shipping rate' })
  async updateRate(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @Param('rateId', ParseObjectIdPipe) rateId: string,
    @Body() dto: UpdateRateDto,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.updateRate(zoneId, rateId, dto, storeId, role);
  }

  @Delete('zones/:zoneId/rates/:rateId')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Soft-delete a shipping rate' })
  async deleteRate(
    @Param('zoneId', ParseObjectIdPipe) zoneId: string,
    @Param('rateId', ParseObjectIdPipe) rateId: string,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.shippingService.deleteRate(zoneId, rateId, storeId, role);
  }

  // ─── Quote (Public) ───

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get shipping rate quote for a destination & cart items (public)' })
  async quote(@Body() dto: QuoteDto) {
    return this.shippingService.quote(dto);
  }
}
