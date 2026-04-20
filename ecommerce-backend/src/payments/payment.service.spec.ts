import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './schemas/payment.schema';
import { EventBusService } from '../shared/events/event-bus.service';

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
    create: jest.fn().mockResolvedValue(mockPayment),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
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
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create a Stripe payment intent and store in DB', async () => {
      const result = await service.createPaymentIntent('607f1f77bcf86cd799439022', 99.99, 'usd');

      expect(result).toHaveProperty('clientSecret');
      expect(result).toHaveProperty('paymentId');
      expect(mockPaymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 99.99,
          currency: 'usd',
          status: 'processing',
        }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('payment.processing', expect.any(Object));
    });

    it('should generate deterministic idempotency key for same order+amount+currency', async () => {
      await service.createPaymentIntent('607f1f77bcf86cd799439022', 99.99, 'usd');
      const firstCall = mockPaymentModel.create.mock.calls[0][0];

      jest.clearAllMocks();
      await service.createPaymentIntent('607f1f77bcf86cd799439022', 99.99, 'usd');
      const secondCall = mockPaymentModel.create.mock.calls[0][0];

      // Same inputs should produce the same idempotency key
      expect(firstCall.idempotencyKey).toBe(secondCall.idempotencyKey);
    });

    it('should generate different idempotency keys for different amounts', async () => {
      await service.createPaymentIntent('607f1f77bcf86cd799439022', 99.99, 'usd');
      const firstKey = mockPaymentModel.create.mock.calls[0][0].idempotencyKey;

      jest.clearAllMocks();
      await service.createPaymentIntent('607f1f77bcf86cd799439022', 50.00, 'usd');
      const secondKey = mockPaymentModel.create.mock.calls[0][0].idempotencyKey;

      expect(firstKey).not.toBe(secondKey);
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
