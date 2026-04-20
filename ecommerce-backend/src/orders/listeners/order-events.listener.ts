import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderService } from '../order.service';

@Injectable()
export class OrderEventsListener {
  private readonly logger = new Logger(OrderEventsListener.name);

  constructor(private orderService: OrderService) {}

  @OnEvent('payment.completed')
  async handlePaymentCompleted(payload: { orderId: string }) {
    this.logger.log(`Payment completed for order ${payload.orderId}, confirming...`);
    await this.orderService.updateStatus(payload.orderId, 'confirmed');
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(payload: { orderId: string }) {
    this.logger.log(`Payment failed for order ${payload.orderId}, cancelling...`);
    await this.orderService.updateStatus(payload.orderId, 'cancelled', undefined, 'Payment failed');
  }
}
