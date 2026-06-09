import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Inventory, InventoryMovement } from './schemas/inventory.schema';
import { EventBusService } from '../shared/events/event-bus.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockInventoryModel = {
    aggregate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
  };

  const mockMovementModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockEventBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getModelToken(Inventory.name), useValue: mockInventoryModel },
        { provide: getModelToken(InventoryMovement.name), useValue: mockMovementModel },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  describe('checkStock', () => {
    it('should return available stock using aggregation', async () => {
      mockInventoryModel.aggregate.mockResolvedValue([{ _id: null, available: 42 }]);

      const result = await service.checkStock('SKU-001');

      expect(result).toBe(42);
      expect(mockInventoryModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: { variantSku: 'SKU-001' } }),
        ]),
      );
    });

    it('should return 0 for non-existent SKU', async () => {
      mockInventoryModel.aggregate.mockResolvedValue([]);

      const result = await service.checkStock('NONEXISTENT');

      expect(result).toBe(0);
    });
  });

  describe('reserve', () => {
    it('should reserve stock atomically for all items', async () => {
      mockInventoryModel.findOneAndUpdate.mockResolvedValue({
        variantSku: 'SKU-001',
        warehouseId: '607f1f77bcf86cd799439033',
        quantity: 100,
        reserved: 5,
      });

      const items = [
        { variantSku: 'SKU-001', productId: 'prod_001', quantity: 3 },
      ];

      await service.reserve(items, '607f1f77bcf86cd799439022');

      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          variantSku: 'SKU-001',
          $expr: expect.any(Object),
        }),
        { $inc: { reserved: 3 } },
        { new: true },
      );
      expect(mockMovementModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'reserved', quantity: 3 }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('inventory.reserved', expect.any(Object));
    });

    it('should rollback previous reservations if one fails', async () => {
      // First item succeeds, second fails
      mockInventoryModel.findOneAndUpdate
        .mockResolvedValueOnce({ variantSku: 'SKU-001', warehouseId: '607f1f77bcf86cd799439033' })
        .mockResolvedValueOnce(null); // Insufficient stock

      const items = [
        { variantSku: 'SKU-001', productId: 'prod_001', quantity: 2 },
        { variantSku: 'SKU-002', productId: 'prod_002', quantity: 5 },
      ];

      await expect(service.reserve(items, '607f1f77bcf86cd799439022')).rejects.toThrow(BadRequestException);

      // Should have attempted to release the first reservation
      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledTimes(3); // 2 reserves + 1 rollback
    });
  });

  describe('deduct', () => {
    it('should convert reserved to sold', async () => {
      mockInventoryModel.findOneAndUpdate.mockResolvedValue({
        variantSku: 'SKU-001',
        quantity: 95,
        reorderPoint: 10,
      });
      mockInventoryModel.find.mockResolvedValue([]);
      // Mock the findOne used for low stock check
      const findOneMock = jest.fn().mockResolvedValue({ quantity: 95, reorderPoint: 10 });
      (mockInventoryModel as any).findOne = findOneMock;

      const items = [{ variantSku: 'SKU-001', productId: 'prod_001', quantity: 3 }];

      await service.deduct(items, '607f1f77bcf86cd799439022');

      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { variantSku: 'SKU-001', reserved: { $gte: 3 } },
        { $inc: { quantity: -3, reserved: -3 } },
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('inventory.deducted', expect.any(Object));
    });

    it('should emit low stock event when below reorder point', async () => {
      mockInventoryModel.findOneAndUpdate.mockResolvedValue({
        variantSku: 'SKU-001',
        quantity: 5,
        reorderPoint: 10,
      });
      const findOneMock = jest.fn().mockResolvedValue({ quantity: 5, reorderPoint: 10 });
      (mockInventoryModel as any).findOne = findOneMock;

      const items = [{ variantSku: 'SKU-001', productId: 'prod_001', quantity: 3 }];

      await service.deduct(items, '607f1f77bcf86cd799439022');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'inventory.low',
        expect.objectContaining({ variantSku: 'SKU-001', remaining: 5 }),
      );
    });
  });

  describe('restock (C6 — refund returns stock)', () => {
    it('adds quantity back and records a returned movement', async () => {
      mockInventoryModel.findOneAndUpdate.mockResolvedValue({ variantSku: 'SKU-001' });
      const items = [{ variantSku: 'SKU-001', productId: 'prod_001', quantity: 3 }];

      await service.restock(items, '607f1f77bcf86cd799439022');

      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { variantSku: 'SKU-001' },
        { $inc: { quantity: 3 } },
      );
      expect(mockMovementModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'returned', quantity: 3 }),
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('inventory.restocked', expect.any(Object));
    });

    it('no-ops on empty items', async () => {
      await service.restock([], '607f1f77bcf86cd799439022');
      expect(mockInventoryModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('missing/empty items guard (C4 — no crash, no-op)', () => {
    it('release() with undefined items does not throw and touches nothing', async () => {
      await expect(
        service.release(undefined as any, '607f1f77bcf86cd799439022'),
      ).resolves.toBeUndefined();
      expect(mockInventoryModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('deduct() with an empty array no-ops', async () => {
      await service.deduct([], '607f1f77bcf86cd799439022');
      expect(mockInventoryModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('reserve() with undefined items no-ops', async () => {
      await service.reserve(undefined as any, '607f1f77bcf86cd799439022');
      expect(mockInventoryModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('adjust', () => {
    it('should adjust stock and create movement record', async () => {
      mockInventoryModel.findOneAndUpdate.mockResolvedValue({
        variantSku: 'SKU-001',
        warehouseId: '607f1f77bcf86cd799439033',
        quantity: 110,
      });

      const result = await service.adjust('SKU-001', 10, 'Restock', '507f1f77bcf86cd799439011');

      expect(result).toBeDefined();
      expect(mockInventoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { variantSku: 'SKU-001' },
        { $inc: { quantity: 10 } },
        { new: true, upsert: true },
      );
      expect(mockMovementModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'adjustment', quantity: 10, notes: 'Restock' }),
      );
    });
  });
});
