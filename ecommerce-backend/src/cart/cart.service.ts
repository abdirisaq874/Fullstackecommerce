import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Product } from '../products/schemas/product.schema';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../shared/database/redis.service';
import { roundMoney } from '../shared/utils/helpers';

@Injectable()
export class CartService {
  private readonly guestCartTtl: number;

  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private inventoryService: InventoryService,
    private redis: RedisService,
    private config: ConfigService,
  ) {
    this.guestCartTtl = this.config.get<number>('app.guestCartTtlDays', 7) * 86400;
  }

  async getCart(userId?: string, sessionId?: string): Promise<CartDocument | null> {
    if (userId) {
      // Atomic upsert: find or create in a single operation
      const cart = await this.cartModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $setOnInsert: { userId: new Types.ObjectId(userId), items: [] } },
        { upsert: true, new: true },
      );
      return this.refreshPrices(cart);
    }

    // Guest cart from Redis
    if (sessionId) {
      const data = await this.redis.getJson<any>(`cart:${sessionId}`);
      if (data) {
        return data as any;
      }
    }
    return null;
  }

  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    productId: string,
    variantSku: string,
    quantity: number,
  ): Promise<CartDocument> {
    // Validate product and variant
    const product = await this.productModel.findById(productId);
    if (!product || product.status !== 'active') {
      throw new NotFoundException('Product not found');
    }

    const variant = product.variants.find((v) => v.sku === variantSku);
    if (!variant || !variant.isActive) {
      throw new NotFoundException('Variant not found');
    }

    // Check stock
    const available = await this.inventoryService.checkStock(variantSku);
    if (available < quantity) {
      throw new BadRequestException(`Only ${available} items available`);
    }

    const price = variant.priceOverride || product.basePrice;
    const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];

    const cartItem = {
      productId: product._id,
      variantSku,
      productName: product.name,
      variantName: variant.name || variantSku,
      imageUrl: primaryImage?.url || '',
      quantity,
      unitPrice: price,
    };

    if (userId) {
      let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
      if (!cart) {
        cart = new this.cartModel({ userId: new Types.ObjectId(userId), items: [] });
      }

      // Check if item already in cart
      const existing = cart.items.find((i) => i.variantSku === variantSku);
      if (existing) {
        existing.quantity += quantity;
        existing.unitPrice = price;
      } else {
        cart.items.push(cartItem as any);
      }

      await cart.save();
      return cart;
    }

    // Guest cart → Redis
    if (sessionId) {
      const existing = (await this.redis.getJson<any[]>(`cart:${sessionId}`)) || [];
      const idx = existing.findIndex((i: any) => i.variantSku === variantSku);
      if (idx >= 0) {
        existing[idx].quantity += quantity;
        existing[idx].unitPrice = price;
      } else {
        existing.push(cartItem);
      }
      await this.redis.setJson(`cart:${sessionId}`, existing, this.guestCartTtl);
    }

    return this.getCart(userId, sessionId) as any;
  }

  async updateItemQuantity(
    userId: string,
    variantSku: string,
    quantity: number,
  ): Promise<CartDocument> {
    const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!cart) throw new NotFoundException('Cart not found');

    const item = cart.items.find((i) => i.variantSku === variantSku);
    if (!item) throw new NotFoundException('Item not in cart');

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.variantSku !== variantSku) as any;
    } else {
      const available = await this.inventoryService.checkStock(variantSku);
      if (available < quantity) {
        throw new BadRequestException(`Only ${available} items available`);
      }
      item.quantity = quantity;
    }

    await cart.save();
    return cart;
  }

  async removeItem(userId: string, variantSku: string): Promise<CartDocument> {
    return this.updateItemQuantity(userId, variantSku, 0);
  }

  async clearCart(userId: string, session?: import('mongoose').ClientSession): Promise<void> {
    await this.cartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { items: [], couponCode: null } },
      session ? { session } : {},
    );
  }

  async mergeGuestCart(userId: string, sessionId: string): Promise<void> {
    const guestItems = await this.redis.getJson<any[]>(`cart:${sessionId}`);
    if (!guestItems || guestItems.length === 0) return;

    for (const item of guestItems) {
      try {
        await this.addItem(userId, undefined, item.productId, item.variantSku, item.quantity);
      } catch {
        // Skip items that can't be added (out of stock, etc.)
      }
    }

    await this.redis.del(`cart:${sessionId}`);
  }

  async getCartSummary(userId: string) {
    const cart = await this.getCart(userId);
    if (!cart || cart.items.length === 0) {
      return { items: [], subtotal: 0, itemCount: 0 };
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + roundMoney(item.unitPrice * item.quantity),
      0,
    );

    return {
      items: cart.items,
      subtotal: roundMoney(subtotal),
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  /**
   * Re-validate prices against current product data.
   * Uses a single batch query instead of N+1 per-item lookups.
   */
  private async refreshPrices(cart: CartDocument): Promise<CartDocument> {
    if (cart.items.length === 0) return cart;

    // Batch-fetch all products in one query
    const productIds = [...new Set(cart.items.map((i) => i.productId.toString()))];
    const products = await this.productModel.find({
      _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let updated = false;
    const validItems = [];

    for (const item of cart.items) {
      const product = productMap.get(item.productId.toString());

      if (!product || product.status !== 'active') {
        updated = true;
        continue; // Remove stale items
      }

      const variant = product.variants.find((v) => v.sku === item.variantSku);
      if (!variant || !variant.isActive) {
        updated = true;
        continue;
      }

      const currentPrice = variant.priceOverride || product.basePrice;
      if (item.unitPrice !== currentPrice) {
        item.unitPrice = currentPrice;
        updated = true;
      }
      validItems.push(item);
    }

    if (updated) {
      cart.items = validItems as any;
      await cart.save();
    }

    return cart;
  }
}
