import {
  Controller, Post, Body, Req, Headers, RawBodyRequest,
  HttpCode, HttpStatus, Logger, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { Auth } from '../auth/guards/auth.guards';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-intent')
  @Auth()
  @ApiOperation({ summary: 'Create a payment intent for an order' })
  async createPaymentIntent(
    @Body() body: { orderId: string; amount: number; currency?: string },
  ) {
    return this.paymentService.createPaymentIntent(
      body.orderId,
      body.amount,
      body.currency || 'usd',
    );
  }

  /**
   * Stripe Webhook endpoint.
   * Must receive raw body for signature verification.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body for webhook verification');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      await this.paymentService.handleWebhook(rawBody, signature);
      return { received: true };
    } catch (error: any) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('refund')
  @Auth('admin')
  @ApiOperation({ summary: 'Process a refund for an order' })
  async refund(@Body() body: { orderId: string; amount?: number }) {
    return this.paymentService.processRefund(body.orderId, body.amount);
  }
}
