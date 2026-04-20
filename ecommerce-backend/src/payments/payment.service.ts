import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { Payment } from './schemas/payment.schema';
import { EventBusService } from '../shared/events/event-bus.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    private config: ConfigService,
    private eventBus: EventBusService,
  ) {
    this.stripe = new Stripe(config.get<string>('stripe.secretKey') || '', {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create a Stripe PaymentIntent for an order.
   * Returns the client_secret for frontend Stripe Elements.
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

    this.logger.log(`Stripe webhook: ${event.type}`);

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
  }

  private async handlePaymentSuccess(pi: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentModel.findOneAndUpdate(
      { providerTxId: pi.id },
      { $set: { status: 'completed', paidAt: new Date() } },
      { new: true },
    );

    if (!payment) {
      this.logger.warn(`Payment not found for Stripe PI: ${pi.id}`);
      return;
    }

    await this.eventBus.emit('payment.completed', {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
      amount: payment.amount,
      // Pass items for inventory service (will be looked up from order)
    });

    this.logger.log(`Payment completed: ${payment._id} for order ${payment.orderId}`);
  }

  private async handlePaymentFailure(pi: Stripe.PaymentIntent): Promise<void> {
    const failureMessage =
      pi.last_payment_error?.message || 'Payment failed';

    const payment = await this.paymentModel.findOneAndUpdate(
      { providerTxId: pi.id },
      { $set: { status: 'failed', failureReason: failureMessage } },
      { new: true },
    );

    if (!payment) return;

    await this.eventBus.emit('payment.failed', {
      paymentId: payment._id.toString(),
      orderId: payment.orderId.toString(),
      reason: failureMessage,
    });

    this.logger.log(`Payment failed: ${payment._id} — ${failureMessage}`);
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

    payment.status = refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
    await payment.save();

    await this.eventBus.emit('refund.processed', {
      orderId: payment.orderId.toString(),
      paymentId: payment._id.toString(),
      refundAmount,
      stripeRefundId: refund.id,
    });

    return { refundId: refund.id, amount: refundAmount, status: payment.status };
  }
}
