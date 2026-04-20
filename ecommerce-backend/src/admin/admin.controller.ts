import {
  Controller, Get, Patch, Param, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { OrderService } from '../orders/order.service';
import { ProductService } from '../products/product.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { PaginationDto } from '../shared/database/pagination.dto';
import { IsString, IsOptional } from 'class-validator';

class UpdateOrderStatusDto {
  @IsString() status: string;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly orderService: OrderService,
    private readonly productService: ProductService,
  ) {}

  @Get('dashboard/stats')
  @Auth('admin')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/revenue')
  @Auth('admin')
  @ApiOperation({ summary: 'Get revenue chart data' })
  async getRevenueChart(@Query('days') days?: number) {
    return this.adminService.getRevenueChart(days || 7);
  }

  @Get('dashboard/orders-by-status')
  @Auth('admin')
  @ApiOperation({ summary: 'Get orders grouped by status' })
  async getOrdersByStatus() {
    return this.adminService.getOrdersByStatus();
  }

  @Patch('orders/:id/status')
  @Auth('admin')
  @ApiOperation({ summary: 'Update order status (admin)' })
  async updateOrderStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('_id') adminId: string,
  ) {
    return this.orderService.updateStatus(id, dto.status, adminId, dto.reason);
  }
}
