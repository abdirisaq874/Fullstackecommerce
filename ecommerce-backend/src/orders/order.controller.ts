import {
  Controller, Get, Post, Patch, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { PaginationDto } from '../shared/database/pagination.dto';
import {
  IsString, IsOptional, ValidateNested, MaxLength, MinLength, Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AddressDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  line1: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  postalCode: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @ApiPropertyOptional({ example: '+12125551234' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

class CheckoutDto {
  @ApiProperty({ description: 'Shipping address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @ApiPropertyOptional({ description: 'Billing address (defaults to shipping)', type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

class CancelOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create order from cart (checkout)' })
  async checkout(
    @CurrentUser('_id') userId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.orderService.createFromCart(
      userId,
      dto.shippingAddress,
      dto.billingAddress,
      dto.notes,
    );
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Get my orders' })
  async findMyOrders(
    @CurrentUser('_id') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.orderService.findByUser(userId, pagination);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get order by ID' })
  async findById(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.findByIdForUser(id, userId, role);
  }

  @Patch(':id/cancel')
  @Auth()
  @ApiOperation({ summary: 'Cancel an order' })
  async cancel(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderService.cancel(id, userId, dto.reason);
  }
}
