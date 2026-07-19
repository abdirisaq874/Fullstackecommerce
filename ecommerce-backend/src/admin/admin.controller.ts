import {
  Controller, Get, Patch, Param, Body, Query, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { OrderService } from '../orders/order.service';
import { ProductService } from '../products/product.service';
import { StoresService } from '../stores/stores.service';
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
    private readonly storesService: StoresService,
  ) {}

  /**
   * Dashboard scope: admins see platform-wide aggregates; sellers are scoped to
   * their active store (resolved from X-Store-Id, membership-verified). Returns
   * the storeId to filter by, or undefined for a global (admin) view.
   */
  private async dashboardStoreId(role: string, userId: string, header?: string): Promise<string | undefined> {
    if (role === 'admin') return undefined;
    const { storeId } = await this.storesService.resolveActiveStore(userId, header?.trim() || undefined);
    return storeId;
  }

  @Get('dashboard/stats')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Dashboard statistics (store-scoped for sellers)' })
  async getDashboardStats(
    @CurrentUser('role') role: string,
    @CurrentUser('_id') userId: string,
    @Headers('x-store-id') storeHeader?: string,
  ) {
    return this.adminService.getDashboardStats(await this.dashboardStoreId(role, userId, storeHeader));
  }

  @Get('dashboard/revenue')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Revenue chart (store-scoped for sellers)' })
  async getRevenueChart(
    @CurrentUser('role') role: string,
    @CurrentUser('_id') userId: string,
    @Query('days') days?: number,
    @Headers('x-store-id') storeHeader?: string,
  ) {
    return this.adminService.getRevenueChart(days || 7, await this.dashboardStoreId(role, userId, storeHeader));
  }

  @Get('dashboard/orders-by-status')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Orders grouped by status (store-scoped for sellers)' })
  async getOrdersByStatus(
    @CurrentUser('role') role: string,
    @CurrentUser('_id') userId: string,
    @Headers('x-store-id') storeHeader?: string,
  ) {
    return this.adminService.getOrdersByStatus(await this.dashboardStoreId(role, userId, storeHeader));
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
