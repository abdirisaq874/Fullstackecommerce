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
}
