import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../shared/database/pagination.dto';
import { PAYOUT_STATUSES, PayoutStatus } from '../schemas/seller-payout.schema';

const TRANSACTION_TYPES = ['sale', 'refund'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export class TransactionQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: TRANSACTION_TYPES,
    description: 'Filter by transaction type',
  })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES as unknown as string[])
  type?: TransactionType;

  @ApiPropertyOptional({ description: 'ISO date — inclusive lower bound' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — exclusive upper bound' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class PayoutQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: PAYOUT_STATUSES,
    description: 'Filter by payout status',
  })
  @IsOptional()
  @IsIn(PAYOUT_STATUSES as unknown as string[])
  status?: PayoutStatus;

  @ApiPropertyOptional({ description: 'ISO date — inclusive lower bound' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — exclusive upper bound' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class BalanceResponseDto {
  @ApiPropertyOptional()
  availableCents: number;

  @ApiPropertyOptional()
  pendingCents: number;

  @ApiPropertyOptional()
  lifetimeNetCents: number;

  @ApiPropertyOptional()
  currency: string;

  @ApiPropertyOptional({ description: 'ISO timestamp of next scheduled payout' })
  nextPayoutAt: string;
}

export class TransactionItemDto {
  @ApiPropertyOptional()
  id: string;

  @ApiPropertyOptional()
  createdAt: string;

  @ApiPropertyOptional({ enum: TRANSACTION_TYPES })
  type: TransactionType;

  @ApiPropertyOptional()
  orderId: string;

  @ApiPropertyOptional()
  amountCents: number;

  @ApiPropertyOptional()
  feeCents: number;

  @ApiPropertyOptional()
  netCents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNumber?: string;
}
