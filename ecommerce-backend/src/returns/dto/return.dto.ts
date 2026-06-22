import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../shared/database/pagination.dto';
import {
  REFUND_TYPES,
  RETURN_STATUSES,
  RefundType,
  ReturnStatus,
} from '../schemas/return.schema';

// ─── Customer: create return ───
export class CreateReturnItemDto {
  @ApiProperty({ example: 'SKU-RED-M' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sku: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty: number;

  @ApiProperty({ example: 'damaged' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'Order being returned (must belong to caller)' })
  @IsMongoId()
  orderId: string;

  @ApiProperty({ type: [CreateReturnItemDto], minItems: 1 })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];
}

// ─── Seller: list query ───
export class ReturnQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RETURN_STATUSES })
  @IsOptional()
  @IsEnum(RETURN_STATUSES)
  status?: ReturnStatus;
}

// ─── Seller: status transition ───
export class UpdateReturnStatusDto {
  @ApiProperty({ enum: RETURN_STATUSES })
  @IsEnum(RETURN_STATUSES)
  status: ReturnStatus;

  @ApiPropertyOptional({ description: 'Notes attached to the transition' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

// ─── Seller: inspection / refund decision ───
export class RefundDecisionDto {
  @ApiPropertyOptional({ enum: REFUND_TYPES })
  @IsOptional()
  @IsEnum(REFUND_TYPES)
  type?: RefundType;

  @ApiPropertyOptional({
    description: 'Refund amount in integer cents',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refundAmountCents?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  restockable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  inspectionNotes?: string;
}

export class RecordInspectionDto {
  @ApiProperty({ type: RefundDecisionDto })
  @ValidateNested()
  @Type(() => RefundDecisionDto)
  refundDecision: RefundDecisionDto;
}
