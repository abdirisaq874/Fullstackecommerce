import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
} from '../auth/guards/auth.guards';
import { UserRole } from '../users/schemas/user.schema';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';
import { SellerCustomersService } from './seller-customers.service';
import { CustomerQueryDto } from './dto/customer-query.dto';

@ApiTags('seller-customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
@Controller('seller/customers')
export class SellerCustomersController {
  constructor(
    private readonly sellerCustomersService: SellerCustomersService,
  ) {}

  @Get('/')
  @ApiOperation({
    summary: 'List customers who ordered from this seller',
    description:
      'Aggregated view: order count, lifetime value (LTV), last order timestamp, scoped to the authenticated seller.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of seller customers',
  })
  @StoreScoped(StoreRole.STAFF)
  async list(
    @ActiveStore('storeId') storeId: string,
    @Query() query: CustomerQueryDto,
  ) {
    return this.sellerCustomersService.listForSeller(storeId, query);
  }

  @Get('/:userId')
  @ApiOperation({
    summary: 'Get one customer with their orders (seller-scoped)',
    description:
      'Returns the customer profile plus the orders they placed that include items from this seller. Items in those orders that belong to other sellers are excluded.',
  })
  @ApiResponse({ status: 200, description: 'Customer detail' })
  @ApiResponse({
    status: 404,
    description: 'Customer not found for this seller',
  })
  @StoreScoped(StoreRole.STAFF)
  async getOne(
    @ActiveStore('storeId') storeId: string,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ) {
    return this.sellerCustomersService.getForSeller(storeId, userId);
  }
}
