import {
  Controller, Post, Body, Req, Headers, RawBodyRequest,
  HttpCode, HttpStatus, Logger, BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiExcludeEndpoint, ApiProperty, ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsNumber, IsPositive } from 'class-validator';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';

class CreatePaymentIntentDto {
  @ApiProperty({ description: 'ID of the order to pay for' })
  @IsMongoId()
  orderId: string;
  // NOTE: amount & currency are intentionally NOT accepted — the server charges
  // the order's real total. Sending them is rejected by forbidNonWhitelisted.
}

class RefundDto {
  @ApiProperty({ description: 'ID of the order to refund' })
  @IsMongoId()
  orderId: string;

  @ApiPropertyOptional({ description: 'Partial refund amount; defaults to the full payment' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-intent')
  @Auth()
  @ApiOperation({ summary: 'Create a payment intent for an order' })
  async createPaymentIntent(
    @CurrentUser('_id') userId: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentService.createIntentForOrder(dto.orderId, userId.toString());
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
  async refund(@Body() dto: RefundDto) {
    return this.paymentService.processRefund(dto.orderId, dto.amount);
  }
}
