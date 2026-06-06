import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { Payment } from './schemas/payment.schema';
import { ProcessedWebhookEvent } from './schemas/processed-webhook-event.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { OrderService } from '../orders/order.service';
import { idsEqual } from '../shared/utils/helpers';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(ProcessedWebhookEvent.name)
    private processedEventModel: Model<ProcessedWebhookEvent>,
    private config: ConfigService,
    private eventBus: EventBusService,
    private orderService: OrderService,
  ) {
    this.stripe = new Stripe(config.get<string>('stripe.secretKey') || '', {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Secure entry point for the create-intent route.
   *
   * The amount and currency are derived from the server-side order — the client
   * never supplies them. Also enforces that the caller owns the order, the order
   * is still awaiting payment, and no payment is already in flight for it.
   */
  async createIntentForOrder(
    orderId: string,
    userId: string,
  ): Promise<{ clientSecret: string; paymentId: string }> {
    const order = await this.orderService.findById(orderId);

    // Ownership — 404 (not 403) so a non-owner can't probe which orders exist.
    if (!idsEqual(order.userId, userId)) {
      throw new NotFoundException('Order not found');
    }

    // Only an unpaid, still-open order can be paid.
    if (order.status !== 'pending') {
      throw new BadRequestException('Order is not awaiting payment');
    }

    // Block duplicate charges for the same order.
    const existing = await this.paymentModel.findOne({
      orderId: order._id,
      status: { $in: ['processing', 'completed'] },
    });
    if (existing) {
      throw new BadRequestException('Payment already initiated for this order');
    }

    // Amount + currency come from the order, NEVER from the request body.
    return this.createPaymentIntent(order._id.toString(), order.total, order.currency);
  }

  /**
   * Create a Stripe PaymentIntent for an order.
   * Returns the client_secret for frontend Stripe Elements.
   *
   * Internal: `amount`/`currency` are trusted here, so this must only be called
   * with server-derived values (see createIntentForOrder).
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, string>,
  ): Promise<{ clientSecret: string; paymentId: string }> {
    // Deterministic idempotency key: same order+amount+currency always produces the same key
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${orderId}:${amount}:${currency}`)
      .digest('hex')
      .slice(0, 32);

    // Create Stripe PaymentIntent
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        metadata: {
          orderId,
          ...metadata,
        },
      },
      { idempotencyKey },
    );

    // Record in our DB
    const payment = await this.paymentModel.create({
      orderId: new Types.ObjectId(orderId),
      method: 'credit_card',
      provider: 'stripe',
      providerTxId: paymentIntent.id,
      idempotencyKey,
      amount,
      currency,
      status: 'processing',
    });

    await this.eventBus.emit('payment.processing', {
      paymentId: payment._id.toString(),
      orderId,
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentId: payment._id.toString(),
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret || '',
      );
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // ─── Idempotency gate (claim-first) ───
    // Atomically claim this event id via the unique index. A duplicate-key error
    // means we've already handled it (Stripe retry / replay) → skip safely.
    try {
      await this.processedEventModel.create({ eventId: event.id, type: event.type });
    } catch (err: any) {
      if (err?.code === 11000) {
        this.logger.warn(`Duplicate webhook event ${event.id} (${event.type}) — skipping`);
        return;
      }
      throw err;
    }

    this.logger.log(`Stripe webhook: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          await this.handlePaymentSuccess(pi);
          break;
        }
        case 'payment_intent.payment_failed': {
          const pi = event.data.object as Stripe.PaymentIntent;
          await this.handlePaymentFailure(pi);
          break;
        }
      }
    } catch (err) {
      // Processing failed after claiming — release the claim so Stripe's retry
      // (or a manual replay) can legitimately reprocess this event.
      await this.processedEventModel.deleteOne({ eventId: event.id });
      throw err;
    }
  }

  private async handlePaymentSuccess(pi: Stripe.PaymentIntent): Promise<void> {
    // Only transition (and emit) if not already completed — idempotent even if
    // the same PI is seen more than once outside the event-id dedup.
    const payment = await this.paymentModel.findOneAndUpdate(
      { providerTxId: pi.id, status: { $ne: 'completed' } },
      { $set: { status: 'completed', paidAt: new Date() } },
      { new: true },
    );

    if (!payment) {
      this.logger.warn(`No actionable payment for Stripe PI ${pi.id} (missing or already completed)`);
      return;
    }

    await this.eventBus.emit('payment.completed', {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
      amount: payment.amount,
      // Inventory needs the line items to deduct stock — load from the order.
      items: await this.getOrderItems(payment.orderId.toString()),
    });

    this.logger.log(`Payment completed: ${payment._id} for order ${payment.orderId}`);
  }

  private async handlePaymentFailure(pi: Stripe.PaymentIntent): Promise<void> {
    const failureMessage =
      pi.last_payment_error?.message || 'Payment failed';

    // Only transition (and emit) if not already failed — idempotent on replay.
    const payment = await this.paymentModel.findOneAndUpdate(
      { providerTxId: pi.id, status: { $ne: 'failed' } },
      { $set: { status: 'failed', failureReason: failureMessage } },
      { new: true },
    );

    if (!payment) return;

    await this.eventBus.emit('payment.failed', {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
      reason: failureMessage,
      // Inventory needs the line items to release the reservation — load from the order.
      items: await this.getOrderItems(payment.orderId.toString()),
    });

    this.logger.log(`Payment failed: ${payment._id} — ${failureMessage}`);
  }

  /**
   * Map an order's line items into the {productId, variantSku, quantity} shape
   * the inventory module expects. Returns [] (and logs) if the order can't be
   * loaded, so a webhook never crashes over a missing/odd order.
   */
  private async getOrderItems(
    orderId: string,
  ): Promise<Array<{ productId: string; variantSku: string; quantity: number }>> {
    try {
      const order = await this.orderService.findById(orderId);
      return (order.items || []).map((i: any) => ({
        productId: i.productId?.toString(),
        variantSku: i.variantSku,
        quantity: i.quantity,
      }));
    } catch {
      this.logger.warn(`Could not load items for order ${orderId} — emitting empty items`);
      return [];
    }
  }

  async processRefund(
    orderId: string,
    amount?: number,
  ): Promise<any> {
    const payment = await this.paymentModel.findOne({
      orderId: new Types.ObjectId(orderId),
      status: 'completed',
    });

    if (!payment) {
      throw new BadRequestException('No completed payment found for this order');
    }

    const refundAmount = amount || payment.amount;

    const refund = await this.stripe.refunds.create({
      payment_intent: payment.providerTxId,
      amount: Math.round(refundAmount * 100),
    });

    const isFullRefund = refundAmount >= payment.amount;
    payment.status = isFullRefund ? 'refunded' : 'partially_refunded';
    await payment.save();

    await this.eventBus.emit('refund.processed', {
      orderId: payment.orderId.toString(),
      paymentId: payment._id.toString(),
      refundAmount,
      stripeRefundId: refund.id,
      // Only a full refund returns all units to stock; partial refunds don't
      // map cleanly to whole units, so we don't auto-restock those.
      restock: isFullRefund,
      items: isFullRefund ? await this.getOrderItems(payment.orderId.toString()) : [],
    });

    return { refundId: refund.id, amount: refundAmount, status: payment.status };
  }
}
