import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  ReturnRequest,
  ReturnRequestDocument,
  ReturnStatus,
} from './schemas/return.schema';
import { Order } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import {
  PaginatedResponseDto,
  PaginationDto,
} from '../shared/database/pagination.dto';
import { idsEqual } from '../shared/utils/helpers';
import {
  CreateReturnDto,
  RecordInspectionDto,
  ReturnQueryDto,
} from './dto/return.dto';

/**
 * Allowed status transitions for the RMA state machine.
 *
 *   requested  → approved | rejected
 *   approved   → received
 *   received   → inspected
 *   inspected  → refunded
 *
 * Terminal states: rejected, refunded.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<ReturnStatus, ReturnStatus[]>> =
  Object.freeze({
    requested: ['approved', 'rejected'],
    approved: ['received'],
    received: ['inspected'],
    inspected: ['refunded'],
    rejected: [],
    refunded: [],
  });

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @InjectModel(ReturnRequest.name)
    private readonly returnModel: Model<ReturnRequest>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══════════════════════════════════════════
  // CUSTOMER
  // ═══════════════════════════════════════════

  /**
   * Customer creates a return request against one of their orders.
   * Resolves the sellerId from the order's items (looking up Product → sellerId).
   * Currently supports returns where all referenced SKUs map to a single seller;
   * mixed-seller returns would need to be split per seller (TODO: multi-seller split).
   */
  async create(
    userId: string,
    dto: CreateReturnDto,
  ): Promise<ReturnRequestDocument> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one return item is required');
    }

    const order = await this.orderModel.findById(dto.orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 404 (not 403) so a non-owner cannot confirm the order exists.
    if (!idsEqual(order.userId, userId)) {
      throw new NotFoundException('Order not found');
    }

    // Validate each requested SKU exists on this order with sufficient quantity.
    const skuToOrderLine = new Map<
      string,
      { quantity: number; productId?: Types.ObjectId }
    >();
    for (const line of order.items ?? []) {
      const sku = line.sku || line.variantSku;
      if (!sku) continue;
      const existing = skuToOrderLine.get(sku);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        skuToOrderLine.set(sku, {
          quantity: line.quantity,
          productId: line.productId,
        });
      }
    }

    const productIds = new Set<string>();
    for (const item of dto.items) {
      const orderLine = skuToOrderLine.get(item.sku);
      if (!orderLine) {
        throw new BadRequestException(
          `SKU '${item.sku}' is not part of order ${dto.orderId}`,
        );
      }
      if (item.qty > orderLine.quantity) {
        throw new BadRequestException(
          `Requested qty (${item.qty}) for SKU '${item.sku}' exceeds ordered qty (${orderLine.quantity})`,
        );
      }
      if (orderLine.productId) {
        productIds.add(orderLine.productId.toString());
      }
    }

    // Resolve seller from the involved products.
    const sellerId = await this.resolveSellerId(Array.from(productIds));
    if (!sellerId) {
      throw new BadRequestException(
        'Unable to resolve seller for the requested items',
      );
    }

    const now = new Date();
    const ret = await this.returnModel.create({
      orderId: new Types.ObjectId(dto.orderId),
      userId: new Types.ObjectId(userId),
      sellerId,
      items: dto.items.map((i) => ({
        sku: i.sku,
        qty: i.qty,
        reason: i.reason,
      })),
      status: 'requested',
      statusHistory: [
        {
          status: 'requested',
          at: now,
          byUserId: new Types.ObjectId(userId),
        },
      ],
      refundDecision: { restockable: true },
    });

    await this.eventBus.emit('return.requested', {
      returnId: ret._id.toString(),
      orderId: dto.orderId,
      userId,
      sellerId: sellerId.toString(),
      itemCount: ret.items.length,
    });

    this.logger.log(
      `Return ${ret._id.toString()} created for order ${dto.orderId} by user ${userId}`,
    );

    return ret;
  }

  /**
   * List the authenticated customer's returns.
   */
  async listForUser(
    userId: string,
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<ReturnRequestDocument>> {
    const filter: FilterQuery<ReturnRequest> = {
      userId: new Types.ObjectId(userId),
    };

    const [data, total] = await Promise.all([
      this.returnModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit),
      this.returnModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  // ═══════════════════════════════════════════
  // SELLER
  // ═══════════════════════════════════════════

  /**
   * Paginated returns scoped to a seller. Optional status filter.
   */
  async listForSeller(
    sellerId: string,
    query: ReturnQueryDto,
  ): Promise<PaginatedResponseDto<ReturnRequestDocument>> {
    const filter: FilterQuery<ReturnRequest> = {
      sellerId: new Types.ObjectId(sellerId),
    };
    if (query.status) {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.returnModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit),
      this.returnModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  /**
   * Get a single return for the seller. 404 if not theirs (so a non-owner
   * cannot confirm the return exists).
   */
  async getForSeller(
    sellerId: string,
    id: string,
  ): Promise<ReturnRequestDocument> {
    const ret = await this.returnModel.findOne({
      _id: new Types.ObjectId(id),
      sellerId: new Types.ObjectId(sellerId),
    });
    if (!ret) {
      throw new NotFoundException('Return not found');
    }
    return ret;
  }

  /**
   * Transition the return to a new status. Validates against ALLOWED_TRANSITIONS.
   * Throws 409 ConflictException on invalid transitions.
   */
  async transition(
    id: string,
    sellerId: string,
    newStatus: ReturnStatus,
    notes?: string,
  ): Promise<ReturnRequestDocument> {
    const ret = await this.getForSeller(sellerId, id);

    const allowed = ALLOWED_TRANSITIONS[ret.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException(
        `Cannot transition return from '${ret.status}' to '${newStatus}'`,
      );
    }

    const previousStatus = ret.status;
    ret.status = newStatus;
    ret.statusHistory.push({
      status: newStatus,
      at: new Date(),
      byUserId: new Types.ObjectId(sellerId),
      notes,
    });

    // When approving, mint a return label. Real impl will call the carrier
    // (Shippo / EasyPost) — stubbed for now.
    if (newStatus === 'approved' && !ret.returnLabelUrl) {
      ret.returnLabelUrl = this.generateReturnLabelStub(ret._id.toString());
    }

    await ret.save();

    await this.eventBus.emit(`return.${newStatus}`, {
      returnId: ret._id.toString(),
      orderId: ret.orderId.toString(),
      userId: ret.userId.toString(),
      sellerId: ret.sellerId.toString(),
      previousStatus,
      status: newStatus,
    });

    return ret;
  }

  /**
   * Record the inspection outcome (refund decision). Only allowed when
   * the return is in the 'inspected' state.
   */
  async recordInspection(
    id: string,
    sellerId: string,
    dto: RecordInspectionDto,
  ): Promise<ReturnRequestDocument> {
    const ret = await this.getForSeller(sellerId, id);

    if (ret.status !== 'inspected') {
      throw new ConflictException(
        `Inspection can only be recorded when status is 'inspected' (currently '${ret.status}')`,
      );
    }

    const decision = dto.refundDecision ?? {};
    ret.refundDecision = {
      type: decision.type,
      refundAmountCents: decision.refundAmountCents,
      restockable: decision.restockable ?? true,
      inspectionNotes: decision.inspectionNotes,
    };

    await ret.save();

    await this.eventBus.emit('return.inspection_recorded', {
      returnId: ret._id.toString(),
      orderId: ret.orderId.toString(),
      sellerId: ret.sellerId.toString(),
      refundDecision: ret.refundDecision,
    });

    return ret;
  }

  // ═══════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════

  /**
   * Resolve a single sellerId from the products referenced by the return.
   * Returns null if products span multiple sellers (caller decides how to
   * surface that — current behavior is to reject the request).
   */
  private async resolveSellerId(
    productIds: string[],
  ): Promise<Types.ObjectId | null> {
    if (productIds.length === 0) return null;

    const objectIds = productIds.map((id) => new Types.ObjectId(id));
    const products = await this.productModel
      .find({ _id: { $in: objectIds } })
      .select({ sellerId: 1 })
      .lean();

    const sellers = new Set(
      products
        .map((p) => p.sellerId?.toString())
        .filter((s): s is string => !!s),
    );

    if (sellers.size !== 1) return null;
    return new Types.ObjectId([...sellers][0]);
  }

  /**
   * TODO: integrate carrier (Shippo / EasyPost) to mint a real prepaid return
   * label. For now we return a stable, shaped placeholder URL so downstream
   * UI / emails can render normally.
   */
  private generateReturnLabelStub(returnId: string): string {
    return `https://labels.example.com/returns/${returnId}.pdf`;
  }
}
