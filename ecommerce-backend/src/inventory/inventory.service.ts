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

  async checkStock(variantSku: string): Promise<number> {
    // Use aggregation for an atomic, single-query stock check
    const result = await this.inventoryModel.aggregate([
      { $match: { variantSku } },
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
        { variantSku: item.variantSku, reserved: { $gte: item.quantity } },
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
      const inv = await this.inventoryModel.findOne({ variantSku: item.variantSku });
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
        { variantSku: item.variantSku },
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
      const updated = await this.inventoryModel.findOneAndUpdate(
        { variantSku: item.variantSku, reserved: { $gte: item.quantity } },
        { $inc: { reserved: -item.quantity } },
      );
      if (!updated) {
        await this.inventoryModel.updateOne(
          { variantSku: item.variantSku },
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
  ): Promise<Inventory> {
    const inv = await this.inventoryModel.findOneAndUpdate(
      { variantSku },
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
