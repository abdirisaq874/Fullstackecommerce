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

/**
 * A guest (not-signed-in) cart, held in Redis under `cart:<cartId>` for
 * `app.guestCartTtlDays`. Mirrors the persisted Cart shape so cart readers do
 * not have to care whether the shopper has an account.
 */
interface GuestCart {
  items: any[];
  couponCode?: string;
}

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

    // Guest cart from Redis. Shaped like a Cart ({ items, couponCode }) so every
    // downstream reader works against one shape regardless of who owns the cart.
    if (sessionId) {
      const cart = await this.readGuestCart(sessionId);
      const { items, changed } = await this.revalidateItems(cart.items);
      if (changed) {
        cart.items = items;
        await this.writeGuestCart(sessionId, cart);
      }
      return { ...cart, items } as any;
    }
    return null;
  }

  /**
   * Read a guest cart from Redis. Tolerates the legacy shape (a bare item array)
   * written before guest carts carried a coupon, so carts already in Redis are
   * not dropped on deploy.
   */
  private async readGuestCart(sessionId: string): Promise<GuestCart> {
    const data = await this.redis.getJson<any>(`cart:${sessionId}`);
    if (Array.isArray(data)) return { items: data, couponCode: undefined };
    return { items: data?.items ?? [], couponCode: data?.couponCode ?? undefined };
  }

  private async writeGuestCart(sessionId: string, cart: GuestCart): Promise<void> {
    await this.redis.setJson(`cart:${sessionId}`, cart, this.guestCartTtl);
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
      available = (await this.inventoryService.checkStock(variant.sku, product._id.toString())) || (product.stock ?? 0);
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
      const guest = await this.readGuestCart(sessionId);
      const idx = guest.items.findIndex((i: any) => i.variantSku === effectiveSku);
      if (idx >= 0) {
        // Stock was checked against `quantity` alone above; adding to an existing
        // line must not push the total past what is actually available.
        const merged = guest.items[idx].quantity + quantity;
        if (available < merged) {
          throw new BadRequestException(`Only ${available} items available`);
        }
        guest.items[idx].quantity = merged;
        guest.items[idx].unitPrice = price;
      } else {
        guest.items.push(cartItem);
      }
      await this.writeGuestCart(sessionId, guest);
    }

    return this.getCart(userId, sessionId) as any;
  }

  async updateItemQuantity(
    userId: string | undefined,
    sessionId: string | undefined,
    variantSku: string,
    quantity: number,
  ): Promise<CartDocument> {
    if (!userId) {
      if (!sessionId) throw new NotFoundException('Cart not found');
      const guest = await this.readGuestCart(sessionId);
      const item = guest.items.find((i: any) => i.variantSku === variantSku);
      if (!item) throw new NotFoundException('Item not in cart');

      if (quantity <= 0) {
        guest.items = guest.items.filter((i: any) => i.variantSku !== variantSku);
      } else {
        const available = await this.availableFor(variantSku, item.productId?.toString());
        if (available < quantity) {
          throw new BadRequestException(`Only ${available} items available`);
        }
        item.quantity = quantity;
      }
      await this.writeGuestCart(sessionId, guest);
      return this.getCart(undefined, sessionId) as any;
    }

    const cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!cart) throw new NotFoundException('Cart not found');

    const item = cart.items.find((i) => i.variantSku === variantSku);
    if (!item) throw new NotFoundException('Item not in cart');

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.variantSku !== variantSku) as any;
    } else {
      const available = await this.availableFor(variantSku, item.productId?.toString());
      if (available < quantity) {
        throw new BadRequestException(`Only ${available} items available`);
      }
      item.quantity = quantity;
    }

    await cart.save();
    return cart;
  }

  /**
   * Stock available for a cart line. Simple products carry a
   * `simple:<productId>` sentinel SKU and use product-level stock; variant
   * products use SKU-level inventory, falling back to product stock when the
   * SKU was never inventory-tracked (imported/seeded variants).
   */
  private async availableFor(variantSku: string, productId?: string): Promise<number> {
    if (variantSku.startsWith('simple:')) {
      const product = await this.productModel.findById(variantSku.slice('simple:'.length));
      return product?.stock ?? 0;
    }
    const tracked = await this.inventoryService.checkStock(variantSku, productId);
    if (tracked > 0) return tracked;
    const product = productId ? await this.productModel.findById(productId) : null;
    return product?.stock ?? 0;
  }

  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    variantSku: string,
  ): Promise<CartDocument> {
    return this.updateItemQuantity(userId, sessionId, variantSku, 0);
  }

  async clearCart(userId: string, session?: import('mongoose').ClientSession): Promise<void> {
    await this.cartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: { items: [], couponCode: null } },
      session ? { session } : {},
    );
  }

  async clearGuestCart(sessionId: string): Promise<void> {
    await this.redis.del(`cart:${sessionId}`);
  }

  /**
   * Fold a guest cart into the user's cart at sign-in/sign-up, then drop the
   * guest copy. Quantities add to any line the user already had. Items that can
   * no longer be added (out of stock, product deactivated) are skipped rather
   * than failing the login.
   */
  async mergeGuestCart(userId: string, sessionId: string): Promise<void> {
    const guest = await this.readGuestCart(sessionId);
    if (guest.items.length === 0) {
      await this.redis.del(`cart:${sessionId}`);
      return;
    }

    for (const item of guest.items) {
      try {
        await this.addItem(userId, undefined, item.productId, item.variantSku, item.quantity);
      } catch {
        // Skip items that can't be added (out of stock, etc.)
      }
    }

    // Carry the guest's coupon over only if the user's cart has none.
    if (guest.couponCode) {
      await this.cartModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), $or: [{ couponCode: null }, { couponCode: { $exists: false } }] },
        { $set: { couponCode: guest.couponCode } },
      );
    }

    await this.redis.del(`cart:${sessionId}`);
  }

  async getCartSummary(userId?: string, sessionId?: string) {
    const cart = await this.getCart(userId, sessionId);
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
      .select('sellerId slug')
      .lean();
    const storeByProduct = new Map(
      products.map((p: any) => [p._id.toString(), p.sellerId ? p.sellerId.toString() : undefined]),
    );
    // slug is the catalog id used by external ad feeds (Meta/Google); expose it
    // on each line so the storefront can tag checkout/purchase pixel events with
    // a content_id that matches the product feed.
    const slugByProduct = new Map(
      products.map((p: any) => [p._id.toString(), p.slug as string | undefined]),
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
        slug: slugByProduct.get(item.productId.toString()),
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

  /** Validate + attach a coupon to the cart. Throws if the code is invalid. */
  async applyCoupon(userId: string | undefined, sessionId: string | undefined, code: string) {
    const { subtotal } = await this.getCartSummary(userId, sessionId);
    if (subtotal <= 0) throw new BadRequestException('Your cart is empty');
    await this.couponService.validateForCart(code, subtotal); // throws BadRequest if invalid
    const normalized = code.trim().toUpperCase();

    if (userId) {
      await this.cartModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { couponCode: normalized } },
      );
    } else if (sessionId) {
      const guest = await this.readGuestCart(sessionId);
      guest.couponCode = normalized;
      await this.writeGuestCart(sessionId, guest);
    }
    return this.getCartSummary(userId, sessionId);
  }

  async removeCoupon(userId?: string, sessionId?: string) {
    if (userId) {
      await this.cartModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { couponCode: null } },
      );
    } else if (sessionId) {
      const guest = await this.readGuestCart(sessionId);
      guest.couponCode = undefined;
      await this.writeGuestCart(sessionId, guest);
    }
    return this.getCartSummary(userId, sessionId);
  }

  /**
   * Re-validate prices against current product data.
   * Uses a single batch query instead of N+1 per-item lookups.
   */
  private async refreshPrices(cart: CartDocument): Promise<CartDocument> {
    const { items, changed } = await this.revalidateItems(cart.items);
    if (changed) {
      cart.items = items as any;
      await cart.save();
    }
    return cart;
  }

  /**
   * Re-validate cart lines against current product data: drop items whose
   * product/variant is gone or deactivated, and pull prices forward. Shared by
   * the signed-in (Mongo) and guest (Redis) paths so a guest cart can't quietly
   * hold a stale price on the way to checkout.
   *
   * Uses a single batch query instead of N+1 per-item lookups.
   */
  private async revalidateItems(items: any[]): Promise<{ items: any[]; changed: boolean }> {
    if (!items || items.length === 0) return { items: items || [], changed: false };

    // Batch-fetch all products in one query
    const productIds = [...new Set(items.map((i) => i.productId.toString()))];
    const products = await this.productModel.find({
      _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let changed = false;
    const validItems: any[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId.toString());

      if (!product || product.status !== 'active') {
        changed = true;
        continue; // Remove stale items
      }

      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

      let currentPrice: number;
      if (hasVariants) {
        const variant = product.variants.find((v) => v.sku === item.variantSku);
        if (!variant || !variant.isActive) {
          changed = true;
          continue; // variant removed/disabled → drop stale line
        }
        currentPrice = variant.priceOverride || product.basePrice;
      } else {
        // Simple product (sentinel SKU) — price comes from the product itself.
        currentPrice = product.basePrice;
      }

      if (item.unitPrice !== currentPrice) {
        item.unitPrice = currentPrice;
        changed = true;
      }
      validItems.push(item);
    }

    return { items: validItems, changed };
  }
}
