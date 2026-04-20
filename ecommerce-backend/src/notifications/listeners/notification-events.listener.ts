import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationService } from '../notification.service';
import { User } from '../../users/schemas/user.schema';

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(
    private notificationService: NotificationService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  @OnEvent('user.registered')
  async handleUserRegistered(payload: { userId: string; email: string; firstName: string }) {
    await this.notificationService.sendEmail(
      payload.email,
      'Welcome to our store!',
      `<h1>Welcome, ${payload.firstName}!</h1>
       <p>Thank you for creating an account. Start shopping today!</p>`,
    );

    await this.notificationService.createInAppNotification(
      payload.userId, 'system', 'Welcome!',
      `Welcome to our store, ${payload.firstName}!`,
    );
  }

  @OnEvent('order.placed')
  async handleOrderPlaced(payload: {
    orderId: string; orderNumber: string; userId: string; total: number; currency: string;
  }) {
    const user = await this.userModel.findById(payload.userId);
    if (!user) return;

    await this.notificationService.sendEmail(
      user.email,
      `Order Confirmed — ${payload.orderNumber}`,
      `<h1>Order Placed!</h1>
       <p>Hi ${user.firstName}, your order <strong>${payload.orderNumber}</strong> has been placed.</p>
       <p>Total: <strong>$${payload.total.toFixed(2)} ${payload.currency.toUpperCase()}</strong></p>
       <p>We'll send you a confirmation once payment is processed.</p>`,
    );

    await this.notificationService.createInAppNotification(
      payload.userId, 'order_update',
      `Order ${payload.orderNumber} placed`,
      `Your order for $${payload.total.toFixed(2)} has been placed.`,
      'order', payload.orderId,
    );
  }

  @OnEvent('payment.completed')
  async handlePaymentCompleted(payload: { orderId: string; amount: number }) {
    this.logger.log(`Sending payment receipt for order ${payload.orderId}`);
    // Would send receipt email — similar pattern to above
  }

  @OnEvent('order.shipped')
  async handleOrderShipped(payload: { orderId: string; orderNumber: string; userId: string }) {
    const user = await this.userModel.findById(payload.userId);
    if (!user) return;

    await this.notificationService.sendEmail(
      user.email,
      `Your order ${payload.orderNumber} has shipped!`,
      `<h1>Order Shipped!</h1>
       <p>Hi ${user.firstName}, your order <strong>${payload.orderNumber}</strong> is on its way.</p>`,
    );

    await this.notificationService.createInAppNotification(
      payload.userId, 'order_update',
      `Order ${payload.orderNumber} shipped`,
      'Your order is on its way!',
      'order', payload.orderId,
    );
  }

  @OnEvent('password.reset_requested')
  async handlePasswordReset(payload: {
    userId: string; email: string; resetToken: string; firstName: string;
  }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    await this.notificationService.sendEmail(
      payload.email,
      'Reset Your Password',
      `<h1>Password Reset</h1>
       <p>Hi ${payload.firstName}, click the link below to reset your password:</p>
       <p><a href="${frontendUrl}/reset-password?token=${payload.resetToken}">Reset Password</a></p>
       <p>This link expires in 1 hour.</p>`,
    );
  }
}
