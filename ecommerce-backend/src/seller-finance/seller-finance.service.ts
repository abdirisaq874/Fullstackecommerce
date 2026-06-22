import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import {
  SellerPayout,
  SellerPayoutDocument,
} from './schemas/seller-payout.schema';
import {
  PaginatedResponseDto,
} from '../shared/database/pagination.dto';
import {
  TransactionQueryDto,
  PayoutQueryDto,
  TransactionItemDto,
  BalanceResponseDto,
} from './dto/finance-query.dto';

/**
 * Platform commission applied to gross seller revenue. Held centrally so the
 * same constant is used for balance projection and (future) payout creation.
 */
const PLATFORM_FEE_RATE = 0.05; // 5%

// Order statuses considered "money in hand" — eligible for the available balance
// once not yet paid out.
const PAID_OUT_STATUSES = ['delivered', 'refunded'];
const AVAILABLE_STATUSES = ['delivered'];
// Pending — money expected but still in motion.
const PENDING_STATUSES = ['confirmed', 'processing', 'shipped'];

@Injectable()
export class SellerFinanceService {
  private readonly logger = new Logger(SellerFinanceService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(SellerPayout.name)
    private readonly payoutModel: Model<SellerPayout>,
  ) {}

  /**
   * Aggregate balance for a seller from existing Order data.
   *
   * NOTE: legacy Order line items don't carry sellerId, so we resolve seller
   * ownership via the products collection. Item subtotals are floats in the
   * legacy schema — we multiply by 100 and round at aggregation time to land
   * on integer cents.
   */
  async balance(sellerId: string): Promise<BalanceResponseDto> {
    const sellerObjectId = new Types.ObjectId(sellerId);

    // Resolve all product ids owned by this seller. Using a plain find + lean
    // because the result set is bounded by the seller's catalog (manageable
    // for any reasonable seller) and we need just _id.
    const sellerProducts = await this.productModel
      .find({ sellerId: sellerObjectId })
      .select('_id')
      .lean();
    const sellerProductIds = sellerProducts.map((p) => p._id);

    if (sellerProductIds.length === 0) {
      return {
        availableCents: 0,
        pendingCents: 0,
        lifetimeNetCents: 0,
        currency: 'USD',
        nextPayoutAt: this.computeNextPayoutAt(new Date()).toISOString(),
      };
    }

    // Single aggregation: sum gross cents per "bucket" (available / pending /
    // lifetime) by matching the relevant order status sets.
    const allRelevantStatuses = Array.from(
      new Set([
        ...AVAILABLE_STATUSES,
        ...PENDING_STATUSES,
        ...PAID_OUT_STATUSES,
      ]),
    );

    const aggResult = await this.orderModel.aggregate<{
      _id: string;
      grossCents: number;
      currency: string;
    }>([
      { $match: { status: { $in: allRelevantStatuses } } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $in: sellerProductIds } } },
      {
        $group: {
          _id: '$status',
          // totalPrice is a legacy float — convert to integer cents.
          grossCents: {
            $sum: { $round: [{ $multiply: ['$items.totalPrice', 100] }, 0] },
          },
          currency: { $first: '$currency' },
        },
      },
    ]);

    const byStatus = new Map<string, number>();
    let currency = 'USD';
    for (const row of aggResult) {
      byStatus.set(row._id, row.grossCents);
      if (row.currency) currency = row.currency;
    }

    const grossAvailableCents = AVAILABLE_STATUSES.reduce(
      (sum, s) => sum + (byStatus.get(s) ?? 0),
      0,
    );
    const grossPendingCents = PENDING_STATUSES.reduce(
      (sum, s) => sum + (byStatus.get(s) ?? 0),
      0,
    );
    const grossLifetimeCents = PAID_OUT_STATUSES.reduce(
      (sum, s) => sum + (byStatus.get(s) ?? 0),
      0,
    );

    // Subtract sums already disbursed via SellerPayout (status paid/processing).
    const [paidOutAgg] = await this.payoutModel.aggregate<{
      paidOutCents: number;
    }>([
      {
        $match: {
          sellerId: sellerObjectId,
          status: { $in: ['paid', 'processing'] },
        },
      },
      {
        $group: {
          _id: null,
          paidOutCents: { $sum: '$amountCents' },
        },
      },
    ]);
    const paidOutCents = paidOutAgg?.paidOutCents ?? 0;

    const availableNetCents = Math.max(
      0,
      Math.round(grossAvailableCents * (1 - PLATFORM_FEE_RATE)) - paidOutCents,
    );
    const pendingNetCents = Math.round(
      grossPendingCents * (1 - PLATFORM_FEE_RATE),
    );
    const lifetimeNetCents = Math.round(
      grossLifetimeCents * (1 - PLATFORM_FEE_RATE),
    );

    return {
      availableCents: availableNetCents,
      pendingCents: pendingNetCents,
      lifetimeNetCents,
      currency,
      nextPayoutAt: this.computeNextPayoutAt(new Date()).toISOString(),
    };
  }

  /**
   * List transactions (sales / refunds) for a seller, derived from Order data.
   * Each transaction represents the seller's slice of a single order.
   */
  async listTransactions(
    sellerId: string,
    query: TransactionQueryDto,
  ): Promise<PaginatedResponseDto<TransactionItemDto>> {
    const sellerObjectId = new Types.ObjectId(sellerId);

    const sellerProducts = await this.productModel
      .find({ sellerId: sellerObjectId })
      .select('_id')
      .lean();
    const sellerProductIds = sellerProducts.map((p) => p._id);

    if (sellerProductIds.length === 0) {
      return new PaginatedResponseDto<TransactionItemDto>(
        [],
        0,
        query.page,
        query.limit,
      );
    }

    // Build the order-level filter. Only orders containing this seller's items
    // are considered; refunds are surfaced as a separate row type.
    const baseMatch: FilterQuery<Order> = {
      'items.productId': { $in: sellerProductIds },
      status: { $in: [...AVAILABLE_STATUSES, ...PENDING_STATUSES, 'refunded'] },
    };

    if (query.from || query.to) {
      baseMatch.createdAt = {};
      if (query.from) (baseMatch.createdAt as any).$gte = new Date(query.from);
      if (query.to) (baseMatch.createdAt as any).$lt = new Date(query.to);
    }

    // Pipeline: filter orders → compute per-order seller subtotal (in cents)
    // → project as transaction rows (sale + optional refund mirror).
    const pipeline: any[] = [
      { $match: baseMatch },
      {
        $project: {
          orderNumber: 1,
          status: 1,
          createdAt: 1,
          // sum subtotal of items belonging to this seller, in cents
          sellerGrossCents: {
            $round: [
              {
                $multiply: [
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$items',
                            as: 'it',
                            cond: {
                              $in: ['$$it.productId', sellerProductIds],
                            },
                          },
                        },
                        as: 'si',
                        in: '$$si.totalPrice',
                      },
                    },
                  },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          orderNumber: 1,
          status: 1,
          createdAt: 1,
          sellerGrossCents: 1,
          feeCents: {
            $round: [
              { $multiply: ['$sellerGrossCents', PLATFORM_FEE_RATE] },
              0,
            ],
          },
        },
      },
      {
        $project: {
          orderNumber: 1,
          status: 1,
          createdAt: 1,
          sellerGrossCents: 1,
          feeCents: 1,
          netCents: { $subtract: ['$sellerGrossCents', '$feeCents'] },
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const orders = await this.orderModel.aggregate<{
      _id: Types.ObjectId;
      orderNumber: string;
      status: string;
      createdAt: Date;
      sellerGrossCents: number;
      feeCents: number;
      netCents: number;
    }>(pipeline);

    // Expand into transaction rows. A refunded order yields both a sale row
    // (original) and a refund row (negative amounts). Filter by `type` last.
    const rows: TransactionItemDto[] = [];
    for (const o of orders) {
      const isRefund = o.status === 'refunded';

      rows.push({
        id: `${o._id.toString()}-sale`,
        createdAt: o.createdAt.toISOString(),
        type: 'sale',
        orderId: o._id.toString(),
        orderNumber: o.orderNumber,
        amountCents: o.sellerGrossCents,
        feeCents: o.feeCents,
        netCents: o.netCents,
      });

      if (isRefund) {
        rows.push({
          id: `${o._id.toString()}-refund`,
          createdAt: o.createdAt.toISOString(),
          type: 'refund',
          orderId: o._id.toString(),
          orderNumber: o.orderNumber,
          amountCents: -o.sellerGrossCents,
          feeCents: -o.feeCents,
          netCents: -o.netCents,
        });
      }
    }

    const filtered = query.type
      ? rows.filter((r) => r.type === query.type)
      : rows;

    // Manual paging because rows are projected post-aggregation.
    const total = filtered.length;
    const start = query.skip;
    const paged = filtered.slice(start, start + query.limit);

    return new PaginatedResponseDto<TransactionItemDto>(
      paged,
      total,
      query.page,
      query.limit,
    );
  }

  async listPayouts(
    sellerId: string,
    query: PayoutQueryDto,
  ): Promise<PaginatedResponseDto<SellerPayoutDocument>> {
    const filter: FilterQuery<SellerPayout> = {
      sellerId: new Types.ObjectId(sellerId),
    };

    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as any).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as any).$lt = new Date(query.to);
    }

    const sortField = query.sortBy ?? 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    const [payouts, total] = await Promise.all([
      this.payoutModel
        .find(filter)
        .sort({ [sortField]: sortDir })
        .skip(query.skip)
        .limit(query.limit),
      this.payoutModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto<SellerPayoutDocument>(
      payouts,
      total,
      query.page,
      query.limit,
    );
  }

  async getPayout(
    payoutId: string,
    sellerId: string,
    role?: string,
  ): Promise<SellerPayoutDocument> {
    const payout = await this.payoutModel.findById(payoutId);
    if (!payout) throw new NotFoundException('Payout not found');

    if (role !== 'admin' && payout.sellerId.toString() !== sellerId) {
      // 404 (not 403) so a non-owner can't confirm the payout exists.
      throw new NotFoundException('Payout not found');
    }

    return payout;
  }

  /**
   * Compute the next payout date — the upcoming Friday at 00:00 UTC.
   * If today IS Friday, returns next week's Friday so we never collide with
   * "already running" payouts.
   */
  private computeNextPayoutAt(now: Date): Date {
    const FRIDAY = 5;
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const currentDow = next.getUTCDay();
    let daysUntilFriday = (FRIDAY - currentDow + 7) % 7;
    if (daysUntilFriday === 0) daysUntilFriday = 7;
    next.setUTCDate(next.getUTCDate() + daysUntilFriday);
    return next;
  }
}
