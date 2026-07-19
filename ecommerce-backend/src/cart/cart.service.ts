import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Product } from '../products/schemas/product.schema';
import { Store } from '../stores/schemas/store.schema';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../shared/database/redis.service';
import { roundMoney } from '../shared/utils/helpers';
import { CouponService } from '../coupons/coupon.service';

@Injectable()
export class CartService {
  private readonly guestCartTtl: number;

  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Store.name) private storeModel: Model<Store>,
    private inventoryService: InventoryService,
    private redis: RedisService,
    private config: ConfigService,
    private couponService: CouponService,
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
    variantSku: string | undefined,
    quantity: number,
  ): Promise<CartDocument> {
    // Validate product
    const product = await this.productModel.findById(productId);
    if (!product || product.status !== 'active') {
      throw new NotFoundException('Product not found');
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

    // Resolve line-item details from either the chosen variant or, for simple
    // (variant-less) products, the product itself.
    let effectiveSku: string;
    let price: number;
    let variantName: string;
    let available: number;

    if (hasVariants) {
      const variant = product.variants.find((v) => v.sku === variantSku);
      if (!variant || !variant.isActive) {
        throw new NotFoundException('Variant not found');
      }
      effectiveSku = variant.sku;
      price = variant.priceOverride || product.basePrice;
      variantName = variant.name || variant.sku;
      // Fall back to product-level stock when the SKU isn't inventory-tracked
      // (imported/seeded variants have no Inventory records).
      available = (await this.inventoryService.checkStock(variant.sku)) || (product.stock ?? 0);
    } else {
      // Simple product: no SKU-level inventory — use the product's own stock.
      effectiveSku = `simple:${product._id.toString()}`;
      price = product.basePrice;
      variantName = product.name;
      available = product.stock ?? 0;
    }

    if (available < quantity) {
      throw new BadRequestException(`Only ${available} items available`);
    }

    const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];

    const cartItem = {
      productId: product._id,
      variantSku: effectiveSku,
      productName: product.name,
      variantName,
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
      const existing = cart.items.find((i) => i.variantSku === effectiveSku);
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
      const idx = existing.findIndex((i: any) => i.variantSku === effectiveSku);
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
      // Simple products carry a `simple:<productId>` sentinel SKU and use
      // product-level stock; variant products use SKU-level inventory.
      let available: number;
      if (variantSku.startsWith('simple:')) {
        const product = await this.productModel.findById(variantSku.slice('simple:'.length));
        available = product?.stock ?? 0;
      } else {
        available = await this.inventoryService.checkStock(variantSku);
        if (available <= 0) {
          const product = await this.productModel.findById(item.productId);
          available = product?.stock ?? 0;
        }
      }
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
      return { items: [], subtotal: 0, itemCount: 0, couponCode: undefined, discountAmount: 0 };
    }

    const subtotal = roundMoney(
      cart.items.reduce((sum, item) => sum + roundMoney(item.unitPrice * item.quantity), 0),
    );

    let couponCode = cart.couponCode || undefined;
    let discountAmount = 0;
    if (couponCode) {
      try {
        const { discount } = await this.couponService.validateForCart(couponCode, subtotal);
        discountAmount = discount;
      } catch {
        couponCode = undefined; // coupon became invalid (expired / threshold) — silently drop
        discountAmount = 0;
      }
    }

    // Enrich each line with its store id + name so the storefront can group the
    // cart/checkout by store. Two batched lookups (products → storeId (sellerId),
    // stores → displayName), no N+1. product.sellerId IS the store id.
    const productIds = [...new Set(cart.items.map((i) => i.productId.toString()))];
    const products = await this.productModel
      .find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
      .select('sellerId')
      .lean();
    const storeByProduct = new Map(
      products.map((p: any) => [p._id.toString(), p.sellerId ? p.sellerId.toString() : undefined]),
    );
    const storeIds = [...new Set([...storeByProduct.values()].filter(Boolean) as string[])];
    const stores = storeIds.length
      ? await this.storeModel
          .find({ _id: { $in: storeIds.map((id) => new Types.ObjectId(id)) } })
          .select('displayName')
          .lean()
      : [];
    const nameByStore = new Map(stores.map((s: any) => [s._id.toString(), s.displayName]));
    const items = cart.items.map((item) => {
      const plain = (item as any).toObject ? (item as any).toObject() : item;
      const storeId = storeByProduct.get(item.productId.toString());
      return {
        ...plain,
        sellerId: storeId, // kept as `sellerId` (== store id) for the order snapshot
        storeName: (storeId && nameByStore.get(storeId)) || 'Store',
      };
    });

    return {
      items,
      subtotal,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      couponCode,
      discountAmount,
    };
  }

  /** Validate + attach a coupon to the user's cart. Throws if the code is invalid. */
  async applyCoupon(userId: string, code: string) {
    const { subtotal } = await this.getCartSummary(userId);
    if (subtotal <= 0) throw new BadRequestException('Your cart is empty');
    await this.couponService.validateForCart(code, subtotal); // throws BadRequest if invalid
    await this.cartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { couponCode: code.trim().toUpperCase() } },
    );
    return this.getCartSummary(userId);
  }

  async removeCoupon(userId: string) {
    await this.cartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { couponCode: null } },
    );
    return this.getCartSummary(userId);
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

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      let currentPrice: number;
      if (hasVariants) {
        const variant = product.variants.find((v) => v.sku === item.variantSku);
        if (!variant || !variant.isActive) {
          updated = true;
          continue; // variant removed/disabled → drop stale line
        }
        currentPrice = variant.priceOverride || product.basePrice;
      } else {
        // Simple product (sentinel SKU) — price comes from the product itself.
        currentPrice = product.basePrice;
      }

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
