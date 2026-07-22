import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatusHistory } from './schemas/order.schema';
import { CartService } from '../cart/cart.service';
import { EventBusService } from '../shared/events/event-bus.service';
import { StoresService } from '../stores/stores.service';
import { OutboxService } from '../outbox/outbox.service';
import { EmailEventType } from '../shared/events/email-event.enum';
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
    private stores: StoresService,
    private outbox: OutboxService,
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
  ): Promise<OrderDocument[]> {
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

    // Split the cart into one order PER STORE (a multi-store cart ⇒ N orders).
    const groups = new Map<string, { storeName?: string; items: any[] }>();
    for (const item of cartSummary.items as any[]) {
      const storeId = item.sellerId ? String(item.sellerId) : 'unassigned';
      let g = groups.get(storeId);
      if (!g) {
        g = { storeName: item.storeName, items: [] };
        groups.set(storeId, g);
      }
      g.items.push(item);
    }

    const session = await this.eventBus.startSession();
    session.startTransaction();
    try {
      const created: OrderDocument[] = [];
      for (const [storeId, group] of groups) {
        const hasStore = storeId !== 'unassigned';
        const orderItems = group.items.map((item) => ({
          productId: item.productId,
          variantSku: item.variantSku,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.variantSku,
          slug: item.slug,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: roundMoney(item.unitPrice * item.quantity),
          sellerId: hasStore ? new Types.ObjectId(storeId) : undefined,
          storeName: group.storeName,
        }));
        const subtotal = roundMoney(orderItems.reduce((s, i) => s + i.totalPrice, 0));
        const total = roundMoney(subtotal); // shippingCost/taxAmount = 0 for now

        const [order] = await this.orderModel.create(
          [
            {
              orderNumber: generateOrderNumber(),
              userId: new Types.ObjectId(userId),
              storeId: hasStore ? new Types.ObjectId(storeId) : undefined,
              storeName: group.storeName,
              // COD needs no payment gate → confirmed on placement; payment stays
              // pending until collected on delivery.
              status: 'confirmed',
              paymentMethod,
              paymentStatus: 'pending',
              items: orderItems,
              shippingAddress,
              billingAddress: billingAddress || shippingAddress,
              subtotal,
              shippingCost: 0,
              taxAmount: 0,
              total,
              currency: 'USD',
              notes,
              placedAt: new Date(),
              confirmedAt: new Date(),
            },
          ],
          { session },
        );

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
            storeId: hasStore ? storeId : undefined,
            items: inventoryItems,
            total: order.total,
            currency: order.currency,
          },
          { session, aggregateType: 'Order', aggregateId: order._id },
        );
        // Seller "new order" email — transactional (same session as the order).
        if (hasStore) {
          await this.outbox.publish(
            {
              eventType: EmailEventType.STORE_ORDER_RECEIVED,
              aggregateType: 'order',
              aggregateId: order._id.toString(),
              payload: {
                storeId,
                storeName: group.storeName,
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                itemCount: orderItems.reduce((s, i) => s + i.quantity, 0),
                total: order.total,
                currency: order.currency,
              },
            },
            { session },
          );
        }
        created.push(order);
      }

      // Buyer "order received" — ONE consolidated email for the whole checkout.
      const firstId = created[0]?._id.toString();
      if (firstId) {
        await this.outbox.publish(
          {
            eventType: EmailEventType.ORDER_PLACED,
            aggregateType: 'checkout',
            aggregateId: firstId,
            idempotencyKey: `order.placed:${userId}:${firstId}`,
            payload: {
              recipientUserId: userId,
              orderId: firstId,
              orders: created.map((o) => ({
                orderNumber: o.orderNumber,
                storeName: o.storeName,
                total: o.total,
              })),
              total: roundMoney(created.reduce((s, o) => s + o.total, 0)),
              currency: created[0].currency,
            },
          },
          { session },
        );
      }

      // Clear cart inside the same transaction to prevent inconsistency.
      await this.cartService.clearCart(userId, session);
      await session.commitTransaction();

      this.logger.log(`Placed ${created.length} order(s) from cart for user ${userId}`);
      return created;
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
    // A seller may view an order belonging to a store they're a member of. New
    // orders are per-store (order.storeId); legacy multi-seller orders are scoped
    // to the member's own line items.
    if (role === 'seller') {
      const order = await this.orderModel.findOne({ _id: new Types.ObjectId(orderId) }).lean();
      if (!order) throw new NotFoundException('Order not found');
      if (order.storeId && (await this.stores.getMembership(order.storeId.toString(), userId))) {
        return order; // whole order — it already belongs to exactly this store
      }
      // legacy (pre-split) orders keyed only via item.sellerId == default store id
      const mine = (order.items || []).filter((it: any) => String(it.sellerId) === userId);
      if (mine.length && (await this.stores.getMembership(userId, userId))) {
        return this.scopeToStore(order, userId);
      }
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      userId: new Types.ObjectId(userId),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Reduce a legacy multi-seller order to one store's view: only that store's
   * line items, subtotal/total recomputed (order-level shipping/tax belong to
   * the whole order, so they're zeroed here).
   */
  private scopeToStore(order: any, storeId: string): any {
    const sid = String(storeId);
    const items = (order.items || []).filter((it: any) => String(it.sellerId) === sid);
    const subtotal = roundMoney(items.reduce((s: number, it: any) => s + (it.totalPrice || 0), 0));
    return { ...order, items, subtotal, total: subtotal, shippingCost: 0, taxAmount: 0, discountAmount: 0 };
  }

  /** A store's sales orders. New orders match on `storeId`; legacy ones on item.sellerId. */
  async findByStore(storeId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<any>> {
    const sid = new Types.ObjectId(storeId);
    const filter = { $or: [{ storeId: sid }, { 'items.sellerId': sid }] };
    const [orders, total] = await Promise.all([
      this.orderModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      this.orderModel.countDocuments(filter),
    ]);
    const scoped = orders.map((o) =>
      o.storeId && String(o.storeId) === String(storeId) ? o : this.scopeToStore(o, storeId),
    );
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

    // Buyer status email (best-effort — must never block the status update).
    const statusEmail: Record<string, EmailEventType> = {
      confirmed: EmailEventType.ORDER_CONFIRMED,
      shipped: EmailEventType.ORDER_SHIPPED,
      delivered: EmailEventType.ORDER_DELIVERED,
      cancelled: EmailEventType.ORDER_CANCELLED,
    };
    const mailEvent = statusEmail[newStatus];
    if (mailEvent) {
      try {
        await this.outbox.publish({
          eventType: mailEvent,
          aggregateType: 'order',
          aggregateId: order._id.toString(),
          payload: {
            recipientUserId: order.userId.toString(),
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            storeId: order.storeId ? order.storeId.toString() : undefined,
            storeName: order.storeName,
            trackingNumber: (order as unknown as { trackingNumber?: string }).trackingNumber,
            reason,
          },
        });
      } catch (e) {
        this.logger.warn(`order status email publish failed: ${(e as Error).message}`);
      }
    }

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
