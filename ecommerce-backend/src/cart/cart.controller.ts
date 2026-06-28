import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AddToCartDto {
  @ApiProperty() @IsString() productId: string;
  @ApiProperty() @IsString() variantSku: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() sessionId?: string;
}

class UpdateQuantityDto {
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
}

class ApplyCouponDto {
  @ApiProperty() @IsString() code: string;
}

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Get current user cart' })
  async getCart(@CurrentUser('_id') userId: string) {
    return this.cartService.getCartSummary(userId);
  }

  @Post('items')
  @Auth()
  @ApiOperation({ summary: 'Add item to cart' })
  async addItem(
    @CurrentUser('_id') userId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addItem(
      userId, undefined, dto.productId, dto.variantSku, dto.quantity,
    );
  }

  @Patch('items/:sku')
  @Auth()
  @ApiOperation({ summary: 'Update item quantity' })
  async updateQuantity(
    @CurrentUser('_id') userId: string,
    @Param('sku') sku: string,
    @Body() dto: UpdateQuantityDto,
  ) {
    return this.cartService.updateItemQuantity(userId, sku, dto.quantity);
  }

  @Delete('items/:sku')
  @Auth()
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(
    @CurrentUser('_id') userId: string,
    @Param('sku') sku: string,
  ) {
    return this.cartService.removeItem(userId, sku);
  }

  @Delete()
  @Auth()
  @ApiOperation({ summary: 'Clear entire cart' })
  async clearCart(@CurrentUser('_id') userId: string) {
    await this.cartService.clearCart(userId);
    return { message: 'Cart cleared' };
  }

  @Post('coupon')
  @Auth()
  @ApiOperation({ summary: 'Apply a coupon code to the cart' })
  async applyCoupon(
    @CurrentUser('_id') userId: string,
    @Body() dto: ApplyCouponDto,
  ) {
    return this.cartService.applyCoupon(userId, dto.code);
  }

  @Delete('coupon')
  @Auth()
  @ApiOperation({ summary: 'Remove the applied coupon from the cart' })
  async removeCoupon(@CurrentUser('_id') userId: string) {
    return this.cartService.removeCoupon(userId);
  }
}
