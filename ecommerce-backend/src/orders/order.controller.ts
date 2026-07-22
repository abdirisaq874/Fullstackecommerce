import {
  Controller, Get, Post, Patch, Body, Param, Query, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { OrderService } from './order.service';
import { OrderDocument } from './schemas/order.schema';
import { MetaConversionsService } from '../marketing/meta-conversions.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import { PaginationDto } from '../shared/database/pagination.dto';
import {
  IsString, IsOptional, ValidateNested, MaxLength, MinLength, Length, IsEnum,
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

  @ApiPropertyOptional({ enum: ['card', 'mpesa', 'waafi', 'cod'], default: 'cod' })
  @IsOptional()
  @IsEnum(['card', 'mpesa', 'waafi', 'cod'])
  paymentMethod?: string;

  // Meta pixel browser id (_fbp) and click id (_fbc) cookies, forwarded from
  // the storefront so the server-side Purchase (Conversions API) can be matched
  // to the same person and de-duplicated with the browser event.
  @ApiPropertyOptional({ description: 'Meta _fbp cookie (browser id)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fbp?: string;

  @ApiPropertyOptional({ description: 'Meta _fbc cookie (click id)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fbc?: string;
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
  constructor(
    private readonly orderService: OrderService,
    private readonly metaConversions: MetaConversionsService,
  ) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create order from cart (checkout)' })
  async checkout(
    @CurrentUser('_id') userId: string,
    @CurrentUser('email') email: string,
    @Body() dto: CheckoutDto,
    @Req() req: Request,
  ) {
    const orders = await this.orderService.createFromCart(
      userId,
      dto.shippingAddress,
      dto.billingAddress,
      dto.notes,
      dto.paymentMethod || 'cod',
    );
    // Mirror each order's Purchase to Meta's Conversions API (server-side,
    // deduped with the browser pixel via event_id = order id). Fire-and-forget:
    // the service swallows its own errors so checkout is never affected.
    this.sendCapiPurchases(orders, dto, userId, email, req);
    return orders;
  }

  private sendCapiPurchases(
    orders: OrderDocument[],
    dto: CheckoutDto,
    userId: string,
    email: string,
    req: Request,
  ): void {
    if (!this.metaConversions.enabled || !orders?.length) return;
    const [firstName, ...rest] = (dto.shippingAddress.fullName || '')
      .trim()
      .split(/\s+/);
    const context = {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent'],
      fbp: dto.fbp,
      fbc: dto.fbc,
    };
    for (const order of orders) {
      const items = order.items || [];
      void this.metaConversions.sendPurchase({
        eventId: String(order._id),
        value: order.total,
        currency: order.currency || 'USD',
        contentIds: items.map((i) => i.slug).filter(Boolean) as string[],
        contents: items
          .filter((i) => i.slug)
          .map((i) => ({ id: i.slug as string, quantity: i.quantity })),
        numItems: items.reduce((sum, i) => sum + i.quantity, 0),
        user: {
          email,
          phone: dto.shippingAddress.phone,
          firstName,
          lastName: rest.join(' '),
          externalId: userId,
        },
        context,
      });
    }
  }

  // Real client IP behind Caddy — prefer the first X-Forwarded-For hop.
  private clientIp(req: Request): string | undefined {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
    return req.ip || req.socket?.remoteAddress || undefined;
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

  @Get('seller')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: "The active store's sales orders" })
  async findSellerOrders(
    @ActiveStore('storeId') storeId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.orderService.findByStore(storeId, pagination);
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
