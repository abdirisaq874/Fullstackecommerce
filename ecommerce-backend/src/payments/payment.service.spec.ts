import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './schemas/payment.schema';
import { ProcessedWebhookEvent } from './schemas/processed-webhook-event.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { OrderService } from '../orders/order.service';

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

  const mockProcessedEventModel = {
    create: jest.fn(),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
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

  const mockOrderService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: getModelToken(ProcessedWebhookEvent.name), useValue: mockProcessedEventModel },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: OrderService, useValue: mockOrderService },
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

  describe('createIntentForOrder (C2 — server-authoritative amount)', () => {
    const ownerId = '507f1f77bcf86cd799439011';
    const otherId = '507f1f77bcf86cd799439099';
    const buildOrder = (overrides = {}) => ({
      _id: { toString: () => '607f1f77bcf86cd799439022' },
      userId: { toString: () => ownerId },
      total: 999,
      currency: 'usd',
      status: 'pending',
      ...overrides,
    });

    it('charges the ORDER total (ignores any client-supplied amount) for the owner', async () => {
      mockOrderService.findById.mockResolvedValue(buildOrder());
      mockPaymentModel.findOne.mockResolvedValue(null);

      const result = await service.createIntentForOrder('607f1f77bcf86cd799439022', ownerId);

      expect(result).toHaveProperty('clientSecret');
      // The recorded amount is the order's 999, not anything the client could send.
      expect(mockPaymentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 999, currency: 'usd' }),
      );
    });

    it('rejects a non-owner with NotFound (IDOR guard)', async () => {
      mockOrderService.findById.mockResolvedValue(buildOrder());
      await expect(
        service.createIntentForOrder('607f1f77bcf86cd799439022', otherId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an order that is not awaiting payment', async () => {
      mockOrderService.findById.mockResolvedValue(buildOrder({ status: 'shipped' }));
      await expect(
        service.createIntentForOrder('607f1f77bcf86cd799439022', ownerId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a payment is already in progress for the order', async () => {
      mockOrderService.findById.mockResolvedValue(buildOrder());
      mockPaymentModel.findOne.mockResolvedValue({ _id: 'existing-payment' });
      await expect(
        service.createIntentForOrder('607f1f77bcf86cd799439022', ownerId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook (C3 — event-id dedup)', () => {
    const event = {
      id: 'evt_replay_c3_001',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_fake_c3_test' } },
    };

    const orderWithItems = {
      items: [{ productId: { toString: () => 'prod1' }, variantSku: 'LAP-001', quantity: 2 }],
    };

    beforeEach(() => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);
      mockPaymentModel.findOneAndUpdate.mockResolvedValue({
        _id: { toString: () => 'p1' },
        orderId: { toString: () => 'o1' },
        amount: 2000,
      });
      mockOrderService.findById.mockResolvedValue(orderWithItems);
    });

    it('processes a new event and emits payment.completed WITH items (claims the id)', async () => {
      mockProcessedEventModel.create.mockResolvedValue({});

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockProcessedEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt_replay_c3_001' }),
      );
      // C4: the inventory listener needs items — they must be in the payload.
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'payment.completed',
        expect.objectContaining({
          items: [{ productId: 'prod1', variantSku: 'LAP-001', quantity: 2 }],
        }),
      );
    });

    it('emits payment.failed WITH items so reserved stock is released (C4)', async () => {
      mockProcessedEventModel.create.mockResolvedValue({});
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        id: 'evt_c4_fail_001',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_x', last_payment_error: { message: 'declined' } } },
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'payment.failed',
        expect.objectContaining({
          items: [{ productId: 'prod1', variantSku: 'LAP-001', quantity: 2 }],
        }),
      );
    });

    it('skips a duplicate (replayed) event without re-processing', async () => {
      const dupErr: any = new Error('E11000 duplicate key');
      dupErr.code = 11000;
      mockProcessedEventModel.create.mockRejectedValue(dupErr);

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockPaymentModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('rolls back the claim if processing throws, so a retry can reprocess', async () => {
      mockProcessedEventModel.create.mockResolvedValue({});
      mockPaymentModel.findOneAndUpdate.mockRejectedValue(new Error('db down'));

      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow('db down');
      expect(mockProcessedEventModel.deleteOne).toHaveBeenCalledWith({ eventId: 'evt_replay_c3_001' });
    });
  });

  describe('processRefund', () => {
    it('should process a full refund and signal restock with items (C6)', async () => {
      mockPaymentModel.findOne.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        amount: 99.99,
        save: jest.fn().mockResolvedValue(true),
      });
      mockOrderService.findById.mockResolvedValue({
        items: [{ productId: { toString: () => 'p' }, variantSku: 'LAP-001', quantity: 1 }],
      });

      const result = await service.processRefund('607f1f77bcf86cd799439022');

      expect(result).toHaveProperty('refundId');
      expect(result.amount).toBe(99.99);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'refund.processed',
        expect.objectContaining({
          restock: true,
          items: [{ productId: 'p', variantSku: 'LAP-001', quantity: 1 }],
        }),
      );
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
      // Partial refund must NOT restock.
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'refund.processed',
        expect.objectContaining({ restock: false }),
      );
    });

    it('should throw if no completed payment found', async () => {
      mockPaymentModel.findOne.mockResolvedValue(null);

      await expect(
        service.processRefund('607f1f77bcf86cd799439022'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
