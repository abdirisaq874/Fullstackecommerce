import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './schemas/payment.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { Order } from '../orders/schemas/order.schema';
import * as crypto from 'crypto';

// Mock Stripe — must handle both default and named exports
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_abc',
    }),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({ id: 're_test_123' }),
  },
};

jest.mock('stripe', () => {
  const MockStripe = jest.fn(() => mockStripeInstance);
  return { __esModule: true, default: MockStripe };
});

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentModel: any;
  let orderModel: any;
  let eventBus: any;

  const mockPayment = {
    _id: { toString: () => '607f1f77bcf86cd799439033' },
    orderId: { toString: () => '607f1f77bcf86cd799439022' },
    providerTxId: 'pi_test_123',
    amount: 99.99,
    currency: 'usd',
    status: 'processing',
    save: jest.fn().mockResolvedValue(true),
  };

  const mockPaymentModel = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  const mockOrder = {
    _id: { toString: () => '607f1f77bcf86cd799439022' },
    userId: { toString: () => 'u1' },
    total: 99.99,
    currency: 'USD',
    status: 'pending',
    items: [{ variantSku: 'sku1', productId: { toString: () => 'p1' }, quantity: 1 }],
  };

  const mockOrderModel = {
    findById: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'stripe.secretKey': 'sk_test_fake',
        'stripe.webhookSecret': 'whsec_test_fake',
      };
      return config[key];
    }),
  };

  const mockEventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    orderModel = module.get(getModelToken(Order.name));
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a Stripe payment intent and store in DB', async () => {
      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockPaymentModel.findOneAndUpdate.mockResolvedValue(mockPayment);

      const result = await service.createPaymentIntent('607f1f77bcf86cd799439022', 'u1', 'customer');

      expect(result).toHaveProperty('clientSecret');
      expect(result).toHaveProperty('paymentId');
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 9999,
          currency: 'usd',
          metadata: expect.objectContaining({ orderId: '607f1f77bcf86cd799439022' }),
        }),
        expect.any(Object),
      );
      expect(mockPaymentModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('payment.processing', expect.any(Object));
    });

    it('should use deterministic idempotency key based on server-side order total', async () => {
      mockOrderModel.findById.mockResolvedValue(mockOrder);
      mockPaymentModel.findOneAndUpdate.mockResolvedValue(mockPayment);

      await service.createPaymentIntent('607f1f77bcf86cd799439022', 'u1', 'customer');

      const expectedKey = crypto
        .createHash('sha256')
        .update('607f1f77bcf86cd799439022:99.99:usd')
        .digest('hex')
        .slice(0, 32);

      const stripeOptions = mockStripeInstance.paymentIntents.create.mock.calls[0][1];
      expect(stripeOptions).toEqual({ idempotencyKey: expectedKey });
    });
  });

  describe('processRefund', () => {
    it('should process a full refund', async () => {
      mockPaymentModel.findOne.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        amount: 99.99,
        save: jest.fn().mockResolvedValue(true),
      });
      mockOrderModel.findById.mockResolvedValue(mockOrder);

      const result = await service.processRefund('607f1f77bcf86cd799439022');

      expect(result).toHaveProperty('refundId');
      expect(result.amount).toBe(99.99);
      expect(mockEventBus.emit).toHaveBeenCalledWith('refund.processed', expect.any(Object));
    });

    it('should process a partial refund', async () => {
      mockPaymentModel.findOne.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        amount: 99.99,
        save: jest.fn().mockResolvedValue(true),
      });
      mockOrderModel.findById.mockResolvedValue(mockOrder);

      const result = await service.processRefund('607f1f77bcf86cd799439022', 25.00);

      expect(result.amount).toBe(25.00);
    });

    it('should throw if no completed payment found', async () => {
      mockPaymentModel.findOne.mockResolvedValue(null);

      await expect(
        service.processRefund('607f1f77bcf86cd799439022'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
