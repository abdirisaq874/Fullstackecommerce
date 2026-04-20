import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order, OrderStatusHistory } from './schemas/order.schema';
import { CartService } from '../cart/cart.service';
import { EventBusService } from '../shared/events/event-bus.service';

describe('OrderService', () => {
  let service: OrderService;
  let orderModel: any;
  let cartService: any;
  let eventBus: any;

  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  };

  const mockCartSummary = {
    items: [
      {
        productId: '507f1f77bcf86cd799439011',
        variantSku: 'HOODIE-BLK-M',
        productName: 'Premium Hoodie',
        variantName: 'Black / M',
        imageUrl: 'https://example.com/img.jpg',
        quantity: 2,
        unitPrice: 49.99,
      },
    ],
    subtotal: 99.98,
    itemCount: 2,
  };

  const mockOrder = {
    _id: { toString: () => '607f1f77bcf86cd799439022' },
    orderNumber: 'ORD-20240115-A1B2',
    userId: { toString: () => '507f1f77bcf86cd799439011' },
    status: 'pending',
    items: mockCartSummary.items,
    total: 99.98,
    currency: 'USD',
    save: jest.fn().mockResolvedValue(true),
  };

  const mockOrderModel = {
    create: jest.fn().mockResolvedValue([mockOrder]),
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockHistoryModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockCartService = {
    getCartSummary: jest.fn().mockResolvedValue(mockCartSummary),
    clearCart: jest.fn().mockResolvedValue(undefined),
  };

  const mockEventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
    startSession: jest.fn().mockResolvedValue(mockSession),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(OrderStatusHistory.name), useValue: mockHistoryModel },
        { provide: CartService, useValue: mockCartService },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  describe('createFromCart', () => {
    it('should create an order from cart within a transaction', async () => {
      const result = await service.createFromCart(
        '507f1f77bcf86cd799439011',
        { fullName: 'John', line1: '123 Main St', city: 'NYC', postalCode: '10001', countryCode: 'US' },
      );

      expect(result).toBeDefined();
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockOrderModel.create).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('order.placed', expect.any(Object), expect.any(Object));
      // Cart should be cleared inside the transaction (before commit)
      expect(mockCartService.clearCart).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        mockSession,
      );
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty cart', async () => {
      mockCartService.getCartSummary.mockResolvedValueOnce({ items: [], subtotal: 0, itemCount: 0 });

      await expect(
        service.createFromCart('507f1f77bcf86cd799439099', { fullName: 'John', line1: '123', city: 'NYC', postalCode: '10001', countryCode: 'US' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should abort transaction on error', async () => {
      mockOrderModel.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.createFromCart('507f1f77bcf86cd799439011', { fullName: 'John', line1: '123', city: 'NYC', postalCode: '10001', countryCode: 'US' }),
      ).rejects.toThrow('DB error');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return order when found', async () => {
      mockOrderModel.findById.mockResolvedValue(mockOrder);
      const result = await service.findById('607f1f77bcf86cd799439022');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when not found', async () => {
      mockOrderModel.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid transition: pending → confirmed', async () => {
      mockOrderModel.findById.mockResolvedValue({ ...mockOrder, status: 'pending', save: jest.fn() });

      await expect(
        service.updateStatus('607f1f77bcf86cd799439022', 'confirmed'),
      ).resolves.toBeDefined();
    });

    it('should reject invalid transition: pending → delivered', async () => {
      mockOrderModel.findById.mockResolvedValue({ ...mockOrder, status: 'pending', save: jest.fn() });

      await expect(
        service.updateStatus('607f1f77bcf86cd799439022', 'delivered'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from terminal state: cancelled → anything', async () => {
      mockOrderModel.findById.mockResolvedValue({ ...mockOrder, status: 'cancelled', save: jest.fn() });

      await expect(
        service.updateStatus('607f1f77bcf86cd799439022', 'confirmed'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should allow user to cancel their own order', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        status: 'pending',
        save: jest.fn(),
      });

      await expect(
        service.cancel('607f1f77bcf86cd799439022', '507f1f77bcf86cd799439011', 'Changed mind'),
      ).resolves.toBeDefined();
    });

    it('should reject cancellation by a different user', async () => {
      mockOrderModel.findById.mockResolvedValue({
        ...mockOrder,
        status: 'pending',
        save: jest.fn(),
      });

      await expect(
        service.cancel('607f1f77bcf86cd799439022', 'different-user-id', 'Trying to cancel'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
