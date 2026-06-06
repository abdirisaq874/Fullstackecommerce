import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { OrderOwnershipGuard } from './order-ownership.guard';

describe('OrderOwnershipGuard', () => {
  let guard: OrderOwnershipGuard;
  let orderService: { findById: jest.Mock };

  const orderId = '607f1f77bcf86cd799439022';
  const ownerId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439099';

  const mockOrder = { userId: { toString: () => ownerId } };

  // Build a minimal ExecutionContext wrapping a fake request.
  const contextFor = (user: any, id: string = orderId, req: any = {}) =>
    ({
      switchToHttp: () => ({
        getRequest: () => Object.assign(req, { params: { id }, user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    orderService = { findById: jest.fn().mockResolvedValue(mockOrder) };
    guard = new OrderOwnershipGuard(orderService as any);
  });

  it('allows the owner', async () => {
    const ctx = contextFor({ _id: ownerId, role: 'customer' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows an admin who is not the owner', async () => {
    const ctx = contextFor({ _id: otherId, role: 'admin' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects a non-owner, non-admin with NotFound (IDOR guard)', async () => {
    const ctx = contextFor({ _id: otherId, role: 'customer' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('rejects a malformed id without touching the DB', async () => {
    const ctx = contextFor({ _id: ownerId, role: 'customer' }, 'not-a-valid-id');
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    expect(orderService.findById).not.toHaveBeenCalled();
  });

  it('stashes the loaded order on the request for the handler to reuse', async () => {
    const req: any = {};
    const ctx = contextFor({ _id: ownerId, role: 'customer' }, orderId, req);
    await guard.canActivate(ctx);
    expect(req.order).toBe(mockOrder);
  });
});
