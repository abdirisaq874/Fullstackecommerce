import { InventoryEventsListener } from './inventory-events.listener';

describe('InventoryEventsListener', () => {
  let listener: InventoryEventsListener;
  let inventory: { reserve: jest.Mock; deduct: jest.Mock; release: jest.Mock; restock: jest.Mock };

  const items = [{ productId: 'p1', variantSku: 'LAP-001', quantity: 2 }];

  beforeEach(() => {
    inventory = {
      reserve: jest.fn().mockResolvedValue(undefined),
      deduct: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      restock: jest.fn().mockResolvedValue(undefined),
    };
    listener = new InventoryEventsListener(inventory as any);
  });

  describe('handleOrderCancelled (C5)', () => {
    it('releases reserved stock when a pending order is cancelled', async () => {
      await listener.handleOrderCancelled({ orderId: 'o1', items, previousStatus: 'pending' });
      expect(inventory.release).toHaveBeenCalledWith(items, 'o1');
    });

    it('releases when previousStatus is absent (defaults to safe release)', async () => {
      await listener.handleOrderCancelled({ orderId: 'o1', items });
      expect(inventory.release).toHaveBeenCalledWith(items, 'o1');
    });

    it('does NOT release a confirmed order (stock already deducted)', async () => {
      await listener.handleOrderCancelled({ orderId: 'o1', items, previousStatus: 'confirmed' });
      expect(inventory.release).not.toHaveBeenCalled();
    });

    it('does NOT release a processing order (stock already deducted)', async () => {
      await listener.handleOrderCancelled({ orderId: 'o1', items, previousStatus: 'processing' });
      expect(inventory.release).not.toHaveBeenCalled();
    });

    it('skips gracefully when there are no items', async () => {
      await listener.handleOrderCancelled({ orderId: 'o1', items: [], previousStatus: 'pending' });
      expect(inventory.release).not.toHaveBeenCalled();
    });
  });

  describe('handleRefundProcessed (C6)', () => {
    it('restocks inventory on a full refund', async () => {
      await listener.handleRefundProcessed({ orderId: 'o1', items, restock: true });
      expect(inventory.restock).toHaveBeenCalledWith(items, 'o1');
    });

    it('does NOT restock on a partial refund', async () => {
      await listener.handleRefundProcessed({ orderId: 'o1', items, restock: false });
      expect(inventory.restock).not.toHaveBeenCalled();
    });

    it('skips when a full refund has no items', async () => {
      await listener.handleRefundProcessed({ orderId: 'o1', items: [], restock: true });
      expect(inventory.restock).not.toHaveBeenCalled();
    });
  });
});
