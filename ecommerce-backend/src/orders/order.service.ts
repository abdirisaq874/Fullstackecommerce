import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatusHistory } from './schemas/order.schema';
import { CartService } from '../cart/cart.service';
import { EventBusService } from '../shared/events/event-bus.service';
import { PaginatedResponseDto, PaginationDto } from '../shared/database/pagination.dto';
import { generateOrderNumber, roundMoney, idsEqual } from '../shared/utils/helpers';

export interface CreateOrderDto {
  shippingAddressId: string;
  billingAddressId?: string;
  notes?: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(OrderStatusHistory.name) private historyModel: Model<OrderStatusHistory>,
    private cartService: CartService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Create order from user's cart.
   * Uses transactional outbox for guaranteed event delivery.
   */
  async createFromCart(
    userId: string,
    shippingAddress: Record<string, any>,
    billingAddress?: Record<string, any>,
    notes?: string,
    paymentMethod = 'cod',
  ): Promise<OrderDocument> {
    // Only cash/pay-on-delivery is live today; card (Stripe), M-Pesa and Waafi
    // are planned. Reject the others server-side so a UI bug can't place an
    // unpayable order.
    if (paymentMethod !== 'cod') {
      throw new BadRequestException('This payment method is not available yet');
    }

    const cartSummary = await this.cartService.getCartSummary(userId);

    if (!cartSummary.items || cartSummary.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Build order items from cart (snapshot everything, incl. the seller so the
    // order can be grouped/shown per store without a later join).
    const orderItems = cartSummary.items.map((item: any) => ({
      productId: item.productId,
      variantSku: item.variantSku,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.variantSku,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: roundMoney(item.unitPrice * item.quantity),
      sellerId: item.sellerId ? new Types.ObjectId(String(item.sellerId)) : undefined,
      storeName: item.storeName,
    }));

    const subtotal = roundMoney(
      orderItems.reduce((sum, item) => sum + item.totalPrice, 0),
    );
    const shippingCost = 0; // Phase 2: calculated from shipping module
    const taxAmount = 0; // Phase 2: calculated from tax service
    const total = roundMoney(subtotal + shippingCost + taxAmount);

    // Create order using transactional outbox
    const session = await this.eventBus.startSession();
    session.startTransaction();

    try {
      const [order] = await this.orderModel.create(
        [
          {
            orderNumber: generateOrderNumber(),
            userId: new Types.ObjectId(userId),
            // COD needs no payment gate, so it's confirmed on placement; payment
            // itself stays pending until collected on delivery.
            status: 'confirmed',
            paymentMethod,
            paymentStatus: 'pending',
            items: orderItems,
            shippingAddress,
            billingAddress: billingAddress || shippingAddress,
            subtotal,
            shippingCost,
            taxAmount,
            total,
            currency: 'USD',
            notes,
            placedAt: new Date(),
            confirmedAt: new Date(),
          },
        ],
        { session },
      );

      // Emit order.placed via outbox (same transaction)
      const inventoryItems = orderItems.map((i) => ({
        variantSku: i.variantSku,
        productId: i.productId.toString(),
        quantity: i.quantity,
      }));

      await this.eventBus.emit(
        'order.placed',
        {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId,
          items: inventoryItems,
          total: order.total,
          currency: order.currency,
        },
        {
          session,
          aggregateType: 'Order',
          aggregateId: order._id,
        },
      );

      // Clear cart inside the same transaction to prevent inconsistency
      await this.cartService.clearCart(userId, session);

      await session.commitTransaction();

      this.logger.log(`Order created: ${order.orderNumber}`);
      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Internal lookup with NO authorization check.
   * Trusted server-side flows (e.g. status updates) call this directly.
   * Request-scoped, ownership-checked reads go through OrderOwnershipGuard.
   */
  async findById(orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByIdForUser(
    orderId: string,
    userId: string,
    role?: string,
  ): Promise<any> {
    if (role === 'admin') {
      return this.findById(orderId);
    }
    // A seller may view an order that contains their products — scoped to just
    // their line items (they must not see other stores' items or full totals).
    if (role === 'seller') {
      const sid = new Types.ObjectId(userId);
      const order = await this.orderModel
        .findOne({ _id: new Types.ObjectId(orderId), 'items.sellerId': sid })
        .lean();
      if (!order) throw new NotFoundException('Order not found');
      return this.scopeToSeller(order, userId);
    }
    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      userId: new Types.ObjectId(userId),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Reduce an order to a single seller's view: only their line items, with the
   * subtotal/total recomputed from those items (order-level shipping/tax/discount
   * belong to the whole order, so they're zeroed in the per-seller view).
   */
  private scopeToSeller(order: any, sellerId: string): any {
    const sid = String(sellerId);
    const items = (order.items || []).filter((it: any) => String(it.sellerId) === sid);
    const subtotal = roundMoney(items.reduce((s: number, it: any) => s + (it.totalPrice || 0), 0));
    return { ...order, items, subtotal, total: subtotal, shippingCost: 0, taxAmount: 0, discountAmount: 0 };
  }

  /** Orders that contain the given seller's products (their sales), scoped to their items. */
  async findBySeller(sellerId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<any>> {
    const filter = { 'items.sellerId': new Types.ObjectId(sellerId) };
    const [orders, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      this.orderModel.countDocuments(filter),
    ]);
    const scoped = orders.map((o) => this.scopeToSeller(o, sellerId));
    return new PaginatedResponseDto(scoped, total, pagination.page, pagination.limit);
  }

  async findByOrderNumber(orderNumber: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderNumber });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findByUser(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<OrderDocument>> {
    const filter = { userId: new Types.ObjectId(userId) };

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit),
      this.orderModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(orders, total, pagination.page, pagination.limit);
  }

  async updateStatus(
    orderId: string,
    newStatus: string,
    changedBy?: string,
    reason?: string,
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    const oldStatus = order.status;

    // Validate status transition
    this.validateStatusTransition(oldStatus, newStatus);

    order.status = newStatus;

    // Set relevant timestamps
    switch (newStatus) {
      case 'confirmed': order.confirmedAt = new Date(); break;
      case 'shipped': order.shippedAt = new Date(); break;
      case 'delivered': order.deliveredAt = new Date(); break;
      case 'cancelled': order.cancelledAt = new Date(); break;
    }

    await order.save();

    // Record status history
    await this.historyModel.create({
      orderId: order._id,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: changedBy ? new Types.ObjectId(changedBy) : undefined,
      reason,
    });

    // Emit status change event
    await this.eventBus.emit(`order.${newStatus}`, {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      userId: order.userId.toString(),
      previousStatus: oldStatus,
      items: order.items.map((i) => ({
        productId: i.productId.toString(),
        variantSku: i.variantSku,
        quantity: i.quantity,
      })),
    });

    return order;
  }

  async cancel(orderId: string, userId: string, reason?: string): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    // 404 (not "Not your order") so a non-owner can't confirm the order exists.
    if (!idsEqual(order.userId, userId)) {
      throw new NotFoundException('Order not found');
    }
    return this.updateStatus(orderId, 'cancelled', userId, reason);
  }

  private validateStatusTransition(from: string, to: string): void {
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: ['refunded'],
      cancelled: [],
      refunded: [],
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new BadRequestException(
        `Cannot transition from '${from}' to '${to}'`,
      );
    }
  }
}
