import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InventoryService, ReserveItem } from '../inventory.service';

@Injectable()
export class InventoryEventsListener {
  private readonly logger = new Logger(InventoryEventsListener.name);

  constructor(private inventoryService: InventoryService) {}

  @OnEvent('order.placed')
  async handleOrderPlaced(payload: {
    orderId: string;
    items: ReserveItem[];
  }) {
    this.logger.log(`Reserving stock for order ${payload.orderId}`);
    try {
      await this.inventoryService.reserve(payload.items, payload.orderId);
    } catch (error: any) {
      this.logger.error(`Stock reservation failed: ${error.message}`);
      // The order service should handle this failure
    }
  }

  @OnEvent('payment.completed')
  async handlePaymentCompleted(payload: {
    orderId: string;
    items: ReserveItem[];
  }) {
    this.logger.log(`Deducting stock for order ${payload.orderId}`);
    await this.inventoryService.deduct(payload.items, payload.orderId);
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(payload: {
    orderId: string;
    items: ReserveItem[];
  }) {
    this.logger.log(`Releasing stock for failed payment ${payload.orderId}`);
    await this.inventoryService.release(payload.items, payload.orderId);
  }

  @OnEvent('order.cancelled')
  async handleOrderCancelled(payload: {
    orderId: string;
    items: ReserveItem[];
    previousStatus?: string;
  }) {
    // Only release reserved stock if the order was still pending (stock was
    // reserved but never deducted). For confirmed/processing/shipped orders
    // the stock was already deducted, so a refund-driven restock must be
    // handled by the refund.processed flow instead — releasing here would
    // double-credit inventory.
    if (payload.previousStatus && payload.previousStatus !== 'pending') {
      return;
    }
    if (!payload.items?.length) return;
    this.logger.log(`Releasing stock for cancelled order ${payload.orderId}`);
    await this.inventoryService.release(payload.items, payload.orderId);
  }

  @OnEvent('refund.processed')
  async handleRefundProcessed(payload: {
    orderId: string;
    items: ReserveItem[];
    restock?: boolean;
  }) {
    if (!payload.restock) return;
    if (!payload.items?.length) return;
    this.logger.log(`Restocking items for refunded order ${payload.orderId}`);
    await this.inventoryService.restock(payload.items, payload.orderId);
  }
}
