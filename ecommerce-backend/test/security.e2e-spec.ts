import { Test } from '@nestjs/testing';
import { OrderController } from '../src/orders/order.controller';
import { OrderService } from '../src/orders/order.service';
import { PaymentController } from '../src/payments/payment.controller';
import { PaymentService } from '../src/payments/payment.service';
import { ProductController } from '../src/products/product.controller';
import { ProductService } from '../src/products/product.service';

describe('Security regression', () => {
  it('OrderController GET /orders/:id enforces per-user lookup', async () => {
    const orderService = {
      findByIdForUser: jest.fn().mockResolvedValue({ ok: true }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: orderService }],
    }).compile();

    const controller = moduleRef.get(OrderController);
    await controller.findById('507f1f77bcf86cd799439011', 'u1', 'customer');

    expect(orderService.findByIdForUser).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'u1',
      'customer',
    );
  });

  it('PaymentController POST /payments/create-intent does not accept client-controlled amount', async () => {
    const paymentService = {
      createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'cs', paymentId: 'p1' }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    }).compile();

    const controller = moduleRef.get(PaymentController);
    await controller.createPaymentIntent('u1', 'customer', { orderId: '507f1f77bcf86cd799439011' });

    expect(paymentService.createPaymentIntent).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'u1',
      'customer',
    );
  });

  it('ProductController PATCH/DELETE enforces ownership-aware service calls', async () => {
    const productService = {
      update: jest.fn().mockResolvedValue({ ok: true }),
      archive: jest.fn().mockResolvedValue({ ok: true }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: productService }],
    }).compile();

    const controller = moduleRef.get(ProductController);
    await controller.update('507f1f77bcf86cd799439011', {}, 'u1', 'seller');
    await controller.archive('507f1f77bcf86cd799439011', 'u1', 'seller');

    expect(productService.update).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      {},
      'u1',
      'seller',
    );
    expect(productService.archive).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'u1',
      'seller',
    );
  });
});

