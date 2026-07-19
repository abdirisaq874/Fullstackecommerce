import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/guards/auth.guards';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { SellerFinanceService } from './seller-finance.service';
import {
  TransactionQueryDto,
  PayoutQueryDto,
  BalanceResponseDto,
} from './dto/finance-query.dto';

@ApiTags('seller-finance')
@ApiBearerAuth()
@Controller('seller/finance')
export class SellerFinanceController {
  constructor(private readonly financeService: SellerFinanceService) {}

  @Get('balance')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Get seller balance summary' })
  @ApiResponse({ status: 200, type: BalanceResponseDto })
  async getBalance(
    @ActiveStore('storeId') storeId: string,
  ): Promise<BalanceResponseDto> {
    return this.financeService.balance(storeId);
  }

  @Get('transactions')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'List seller transactions (sales / refunds)' })
  @ApiResponse({ status: 200, description: 'Paginated transaction list' })
  async listTransactions(
    @ActiveStore('storeId') storeId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.financeService.listTransactions(storeId, query);
  }

  @Get('payouts')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'List seller payouts' })
  @ApiResponse({ status: 200, description: 'Paginated payout list' })
  async listPayouts(
    @ActiveStore('storeId') storeId: string,
    @Query() query: PayoutQueryDto,
  ) {
    return this.financeService.listPayouts(storeId, query);
  }

  @Get('payouts/:id')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Get payout detail' })
  @ApiResponse({ status: 200, description: 'Payout document' })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  async getPayout(
    @Param('id', ParseObjectIdPipe) id: string,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.financeService.getPayout(id, storeId, role);
  }
}
