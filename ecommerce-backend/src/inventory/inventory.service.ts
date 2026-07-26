import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inventory, InventoryMovement } from './schemas/inventory.schema';
import { Product } from '../products/schemas/product.schema';
import { EventBusService } from '../shared/events/event-bus.service';

export interface ReserveItem {
  variantSku: string;
  productId: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<Inventory>,
    @InjectModel(InventoryMovement.name) private movementModel: Model<InventoryMovement>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    private eventBus: EventBusService,
  ) {}

  async checkStock(variantSku: string, productId?: string): Promise<number> {
    // Scope by productId when known: supplier SKUs are NOT unique across sellers in
    // a marketplace, so two products can share a variantSku — each has its own row.
    const match: Record<string, unknown> = { variantSku };
    if (productId) match.productId = new Types.ObjectId(productId);
    const result = await this.inventoryModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          available: { $sum: { $subtract: ['$quantity', '$reserved'] } },
        },
      },
    ]);
    return result[0]?.available ?? 0;
  }

  /**
   * Reserve stock for checkout. Uses atomic findOneAndUpdate
   * with a condition to prevent overselling.
   */
  async reserve(items: ReserveItem[], orderId: string): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn(`reserve: no items for order ${orderId} — skipping`);
      return;
    }
    for (const item of items) {
      const result = await this.inventoryModel.findOneAndUpdate(
        {
          variantSku: item.variantSku,
          ...(item.productId ? { productId: new Types.ObjectId(item.productId) } : {}),
          $expr: { $gte: [{ $subtract: ['$quantity', '$reserved'] }, item.quantity] },
        },
        { $inc: { reserved: item.quantity } },
        { new: true },
      );

      if (!result) {
        // Rollback any previously reserved items
        await this.releaseReservations(items.slice(0, items.indexOf(item)), orderId);
        throw new BadRequestException(
          `Insufficient stock for SKU: ${item.variantSku}`,
        );
      }

      await this.movementModel.create({
        variantSku: item.variantSku,
        warehouseId: result.warehouseId,
        type: 'reserved',
        quantity: item.quantity,
        referenceType: 'order',
        referenceId: new Types.ObjectId(orderId),
      });
    }

    await this.eventBus.emit('inventory.reserved', { orderId, items });
  }

  /**
   * Convert reserved → sold (after payment confirmed)
   */
  async deduct(items: ReserveItem[], orderId: string): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn(`deduct: no items for order ${orderId} — skipping`);
      return;
    }
    for (const item of items) {
      const updated = await this.inventoryModel.findOneAndUpdate(
        {
          variantSku: item.variantSku,
          ...(item.productId ? { productId: new Types.ObjectId(item.productId) } : {}),
          reserved: { $gte: item.quantity },
        },
        { $inc: { quantity: -item.quantity, reserved: -item.quantity } },
      );
      if (!updated) {
        throw new BadRequestException(`Inventory deduction failed for SKU: ${item.variantSku}`);
      }

      await this.movementModel.create({
        variantSku: item.variantSku,
        type: 'sold',
        quantity: -item.quantity,
        referenceType: 'order',
        referenceId: new Types.ObjectId(orderId),
      });

      // Check low stock
      const inv = await this.inventoryModel.findOne({
        variantSku: item.variantSku,
        ...(item.productId ? { productId: new Types.ObjectId(item.productId) } : {}),
      });
      if (inv && inv.quantity <= inv.reorderPoint) {
        await this.eventBus.emit('inventory.low', {
          variantSku: item.variantSku,
          productId: item.productId,
          remaining: inv.quantity,
        });
      }
    }

    await this.eventBus.emit('inventory.deducted', { orderId, items });
  }

  /**
   * Return sold stock back to on-hand quantity (e.g. after a refund).
   * Mirrors deduct(): deduct lowered `quantity`; restock raises it again.
   */
  async restock(items: ReserveItem[], orderId: string): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn(`restock: no items for order ${orderId} — skipping`);
      return;
    }
    for (const item of items) {
      await this.inventoryModel.findOneAndUpdate(
        {
          variantSku: item.variantSku,
          ...(item.productId ? { productId: new Types.ObjectId(item.productId) } : {}),
        },
        { $inc: { quantity: item.quantity } },
      );

      await this.movementModel.create({
        variantSku: item.variantSku,
        type: 'returned',
        quantity: item.quantity,
        referenceType: 'order',
        referenceId: new Types.ObjectId(orderId),
      });
    }

    await this.eventBus.emit('inventory.restocked', { orderId, items });
  }

  /**
   * Release reserved stock (payment failed or order cancelled)
   */
  async release(items: ReserveItem[], orderId: string): Promise<void> {
    if (!Array.isArray(items) || items.length === 0) {
      this.logger.warn(`release: no items for order ${orderId} — skipping`);
      return;
    }
    await this.releaseReservations(items, orderId);
    await this.eventBus.emit('inventory.released', { orderId, items });
  }

  private async releaseReservations(items: ReserveItem[], orderId: string): Promise<void> {
    for (const item of items) {
      const pidMatch = item.productId ? { productId: new Types.ObjectId(item.productId) } : {};
      const updated = await this.inventoryModel.findOneAndUpdate(
        { variantSku: item.variantSku, ...pidMatch, reserved: { $gte: item.quantity } },
        { $inc: { reserved: -item.quantity } },
      );
      if (!updated) {
        await this.inventoryModel.updateOne(
          { variantSku: item.variantSku, ...pidMatch },
          { $set: { reserved: 0 } },
        );
      }

      await this.movementModel.create({
        variantSku: item.variantSku,
        type: 'released',
        quantity: item.quantity,
        referenceType: 'order',
        referenceId: new Types.ObjectId(orderId),
      });
    }
  }

  /**
   * Manual stock adjustment (admin)
   */
  async adjust(
    variantSku: string,
    quantity: number,
    notes: string,
    userId: string,
    productId?: string,
  ): Promise<Inventory> {
    const inv = await this.inventoryModel.findOneAndUpdate(
      { variantSku, ...(productId ? { productId: new Types.ObjectId(productId) } : {}) },
      { $inc: { quantity } },
      { new: true, upsert: true },
    );

    await this.movementModel.create({
      variantSku,
      warehouseId: inv!.warehouseId,
      type: 'adjustment',
      quantity,
      notes,
      createdBy: new Types.ObjectId(userId),
    });

    return inv!;
  }

  /**
   * Set the absolute on-hand quantity for a variant SKU (create the record if it
   * doesn't exist yet). Used by product create/update/import so per-variant stock
   * entered by the seller is actually persisted — reserved is preserved.
   */
  async setStock(variantSku: string, productId: string, quantity: number): Promise<void> {
    if (!variantSku || !productId) return;
    const q = Math.max(0, Math.floor(Number(quantity) || 0));
    // Key on (productId, variantSku): each seller's listing owns its own row even
    // when they share a supplier SKU. The filter fields seed the doc on insert.
    await this.inventoryModel.updateOne(
      { variantSku, productId: new Types.ObjectId(productId) },
      { $set: { quantity: q }, $setOnInsert: { reserved: 0 } },
      { upsert: true },
    );
  }

  /** SKUs (from the given list) that already have an inventory record. */
  async trackedSkus(skus: string[]): Promise<string[]> {
    if (!skus?.length) return [];
    const rows = await this.inventoryModel.find({ variantSku: { $in: skus } }).select('variantSku').lean();
    return rows.map((r: any) => r.variantSku);
  }

  async getStockLevels(productId: string, storeId?: string): Promise<Inventory[]> {
    // When scoped to a store (seller call), the product must belong to it.
    if (storeId) {
      const product = await this.productModel.findById(productId).select('sellerId').lean();
      if (!product || String((product as any).sellerId) !== String(storeId)) {
        throw new NotFoundException('Product not found in this store');
      }
    }
    return this.inventoryModel.find({
      productId: new Types.ObjectId(productId),
    });
  }
}
