import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
} from '@nestjs/swagger';
import { CouponService } from './coupon.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import {
  CreateCouponDto, UpdateCouponDto, CouponQueryDto,
} from './dto/coupon.dto';

@ApiTags('coupons')
@Controller('admin/coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @Auth('admin')
  @ApiOperation({ summary: 'Create a coupon' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  async create(
    @Body() dto: CreateCouponDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.couponService.create(dto, userId);
  }

  @Get()
  @Auth('admin')
  @ApiOperation({ summary: 'List coupons' })
  async list(@Query() query: CouponQueryDto) {
    return this.couponService.findAll(query);
  }

  @Patch(':id')
  @Auth('admin')
  @ApiOperation({ summary: 'Update a coupon (only allowed before any redemptions)' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  @ApiResponse({ status: 409, description: 'Coupon has redemptions; cannot be edited' })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @Auth('admin')
  @ApiOperation({
    summary: 'Soft-delete a coupon (only allowed before any redemptions; otherwise deactivate)',
  })
  @ApiResponse({ status: 200, description: 'Coupon deleted' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  @ApiResponse({ status: 409, description: 'Coupon has redemptions; deactivate instead' })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.couponService.softDelete(id);
  }

  @Patch(':id/deactivate')
  @Auth('admin')
  @ApiOperation({ summary: 'Deactivate a coupon (sets isActive = false)' })
  @ApiResponse({ status: 200, description: 'Coupon deactivated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async deactivate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.couponService.deactivate(id);
  }
}
