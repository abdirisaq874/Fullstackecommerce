import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
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
  @Auth('seller', 'admin')
  @ApiOperation({ summary: 'Get seller balance summary' })
  @ApiResponse({ status: 200, type: BalanceResponseDto })
  async getBalance(
    @CurrentUser('_id') userId: string,
  ): Promise<BalanceResponseDto> {
    return this.financeService.balance(userId);
  }

  @Get('transactions')
  @Auth('seller', 'admin')
  @ApiOperation({ summary: 'List seller transactions (sales / refunds)' })
  @ApiResponse({ status: 200, description: 'Paginated transaction list' })
  async listTransactions(
    @CurrentUser('_id') userId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.financeService.listTransactions(userId, query);
  }

  @Get('payouts')
  @Auth('seller', 'admin')
  @ApiOperation({ summary: 'List seller payouts' })
  @ApiResponse({ status: 200, description: 'Paginated payout list' })
  async listPayouts(
    @CurrentUser('_id') userId: string,
    @Query() query: PayoutQueryDto,
  ) {
    return this.financeService.listPayouts(userId, query);
  }

  @Get('payouts/:id')
  @Auth('seller', 'admin')
  @ApiOperation({ summary: 'Get payout detail' })
  @ApiResponse({ status: 200, description: 'Payout document' })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  async getPayout(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.financeService.getPayout(id, userId, role);
  }
}
