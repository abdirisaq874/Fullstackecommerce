import {
  Controller, Get, Post, Patch, Delete, Body, Param, Headers, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { OptionalAuth, CurrentUser } from '../auth/guards/auth.guards';
import { IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AddToCartDto {
  @ApiProperty() @IsString() productId: string;
  // Optional: simple products (no variants) are added by productId alone.
  @ApiPropertyOptional() @IsOptional() @IsString() variantSku?: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
}

class UpdateQuantityDto {
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
}

class ApplyCouponDto {
  @ApiProperty() @IsString() code: string;
}

/**
 * Cart is deliberately open to guests: requiring an account before add-to-cart
 * collapses the funnel for paid traffic (an ad click has no reason to sign up
 * first) and starves the Meta pixel of AddToCart/InitiateCheckout signal, which
 * in turn stops conversion-optimised campaigns from delivering.
 *
 * Signed-in shoppers are keyed by user id (cart persisted in Mongo); guests send
 * an `X-Cart-Id` they generated locally (cart held in Redis, TTL
 * `app.guestCartTtlDays`). On login the guest cart is folded into the user's —
 * see AuthService. When a request carries both, the user always wins.
 */
@ApiTags('cart')
@ApiHeader({ name: 'X-Cart-Id', required: false, description: 'Guest cart id (ignored when signed in)' })
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Guests must supply a cart id to mutate anything — without it there is no
   * cart to attach the item to.
   */
  private requireOwner(userId?: string, cartId?: string): { userId?: string; cartId?: string } {
    const id = cartId?.trim() || undefined;
    if (!userId && !id) {
      throw new BadRequestException('Sign in or send an X-Cart-Id header to use the cart');
    }
    // Signed in → the guest id is irrelevant; never let it shadow the real cart.
    return userId ? { userId } : { cartId: id };
  }

  @Get()
  @OptionalAuth()
  @ApiOperation({ summary: 'Get the current cart (user or guest)' })
  async getCart(
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    // A visitor with no cart yet is not an error — return the empty cart shape.
    return this.cartService.getCartSummary(userId, userId ? undefined : cartId?.trim() || undefined);
  }

  @Post('items')
  @OptionalAuth()
  @ApiOperation({ summary: 'Add item to cart' })
  async addItem(
    @Body() dto: AddToCartDto,
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    const o = this.requireOwner(userId, cartId);
    return this.cartService.addItem(o.userId, o.cartId, dto.productId, dto.variantSku, dto.quantity);
  }

  @Patch('items/:sku')
  @OptionalAuth()
  @ApiOperation({ summary: 'Update item quantity' })
  async updateQuantity(
    @Param('sku') sku: string,
    @Body() dto: UpdateQuantityDto,
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    const o = this.requireOwner(userId, cartId);
    return this.cartService.updateItemQuantity(o.userId, o.cartId, sku, dto.quantity);
  }

  @Delete('items/:sku')
  @OptionalAuth()
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(
    @Param('sku') sku: string,
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    const o = this.requireOwner(userId, cartId);
    return this.cartService.removeItem(o.userId, o.cartId, sku);
  }

  @Delete()
  @OptionalAuth()
  @ApiOperation({ summary: 'Clear entire cart' })
  async clearCart(
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    const o = this.requireOwner(userId, cartId);
    if (o.userId) await this.cartService.clearCart(o.userId);
    else await this.cartService.clearGuestCart(o.cartId!);
    return { message: 'Cart cleared' };
  }

  @Post('coupon')
  @OptionalAuth()
  @ApiOperation({ summary: 'Apply a coupon code to the cart' })
  async applyCoupon(
    @Body() dto: ApplyCouponDto,
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    const o = this.requireOwner(userId, cartId);
    return this.cartService.applyCoupon(o.userId, o.cartId, dto.code);
  }

  @Delete('coupon')
  @OptionalAuth()
  @ApiOperation({ summary: 'Remove the applied coupon from the cart' })
  async removeCoupon(
    @CurrentUser('_id') userId?: string,
    @Headers('x-cart-id') cartId?: string,
  ) {
    const o = this.requireOwner(userId, cartId);
    return this.cartService.removeCoupon(o.userId, o.cartId);
  }
}
