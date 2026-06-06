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
    // Only a still-reserved (unpaid) order should release its reservation.
    // Once payment completes, stock is DEDUCTED (reserved → 0), so releasing a
    // reservation that no longer exists would drive `reserved` negative.
    if (payload.previousStatus && payload.previousStatus !== 'pending') {
      this.logger.log(
        `Order ${payload.orderId} cancelled from '${payload.previousStatus}' — stock already deducted, nothing to release`,
      );
      return;
    }

    if (!payload.items?.length) {
      this.logger.warn(`Order ${payload.orderId} cancelled with no items to release`);
      return;
    }

    this.logger.log(`Releasing stock for cancelled order ${payload.orderId}`);
    await this.inventoryService.release(payload.items, payload.orderId);
  }

  @OnEvent('refund.processed')
  async handleRefundProcessed(payload: {
    orderId: string;
    items: ReserveItem[];
    restock?: boolean;
  }) {
    // Only full refunds restock (partial refunds don't map to whole units).
    if (!payload.restock) {
      this.logger.log(`Refund for order ${payload.orderId} is partial — not restocking`);
      return;
    }
    if (!payload.items?.length) {
      this.logger.warn(`Refund for order ${payload.orderId} has no items to restock`);
      return;
    }
    this.logger.log(`Restocking inventory for refunded order ${payload.orderId}`);
    await this.inventoryService.restock(payload.items, payload.orderId);
  }
}
