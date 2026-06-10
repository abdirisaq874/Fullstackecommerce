import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { Order } from '../orders/schemas/order.schema';
import { CustomerQueryDto, CustomerSortField } from './dto/customer-query.dto';

/**
 * Aggregated customer view from a seller's perspective.
 *
 * Shape returned by listForSeller / getForSeller — derived from existing
 * Order + User collections, no new schema.
 */
export interface SellerCustomer {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: Date | null;
  firstOrderAt: Date | null;
}

export interface SellerCustomerDetail extends SellerCustomer {
  orders: Array<{
    orderId: string;
    orderNumber: string;
    status: string;
    placedAt: Date | null;
    createdAt: Date;
    currency: string;
    sellerSubtotal: number;
    sellerItemCount: number;
    items: Array<{
      productId: string;
      productName: string;
      variantSku: string;
      variantName: string;
      imageUrl: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  }>;
}

export interface PaginatedSellerCustomers {
  data: SellerCustomer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

@Injectable()
export class SellerCustomersService {
  private readonly logger = new Logger(SellerCustomersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {}

  /**
   * List customers that have purchased from this seller, with LTV / order
   * count / last order timestamp.
   *
   * NOTE: Order.items[] does NOT carry sellerId in the current schema, so we
   * $lookup the Product collection to resolve each item's seller. Once we add
   * items[].sellerId to the Order schema this $lookup can be removed.
   */
  async listForSeller(
    sellerId: string,
    query: CustomerQueryDto,
  ): Promise<PaginatedSellerCustomers> {
    const sellerObjectId = new Types.ObjectId(sellerId);
    const sortDirection: 1 | -1 = query.sortDir === 'asc' ? 1 : -1;
    const sortField = this.toSortFieldKey(query.sortBy);

    const searchMatch = this.buildSearchMatch(query.search);

    const basePipeline: PipelineStage[] = [
      // 1) Resolve each order item's seller via the Product collection.
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: '_product',
          pipeline: [{ $project: { sellerId: 1 } }],
        },
      },
      { $unwind: { path: '$_product', preserveNullAndEmptyArrays: false } },
      { $match: { '_product.sellerId': sellerObjectId } },

      // 2) Re-aggregate items back to one row per order, scoped to this seller.
      {
        $group: {
          _id: '$_id',
          userId: { $first: '$userId' },
          status: { $first: '$status' },
          currency: { $first: '$currency' },
          placedAt: { $first: '$placedAt' },
          createdAt: { $first: '$createdAt' },
          sellerSubtotal: { $sum: '$items.totalPrice' },
        },
      },

      // 3) Group orders by customer to compute LTV / order count / lastOrderAt.
      {
        $group: {
          _id: '$userId',
          orderCount: { $sum: 1 },
          lifetimeValue: { $sum: '$sellerSubtotal' },
          lastOrderAt: {
            $max: { $ifNull: ['$placedAt', '$createdAt'] },
          },
          firstOrderAt: {
            $min: { $ifNull: ['$placedAt', '$createdAt'] },
          },
        },
      },

      // 4) Join user profile.
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                email: 1,
                firstName: 1,
                lastName: 1,
                isDeleted: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      { $match: { 'user.isDeleted': { $ne: true } } },

      // 5) Optional search across name / email.
      ...(searchMatch ? [{ $match: searchMatch }] : []),

      // 6) Project final shape.
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          fullName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          orderCount: 1,
          lifetimeValue: 1,
          lastOrderAt: 1,
          firstOrderAt: 1,
        },
      },
    ];

    const dataPipeline: PipelineStage[] = [
      ...basePipeline,
      { $sort: { [sortField]: sortDirection, userId: 1 } },
      { $skip: query.skip },
      { $limit: query.limit },
    ];

    const countPipeline: PipelineStage[] = [
      ...basePipeline,
      { $count: 'total' },
    ];

    const [data, countResult] = await Promise.all([
      this.orderModel.aggregate<SellerCustomer>(dataPipeline),
      this.orderModel.aggregate<{ total: number }>(countPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / query.limit) || 0;

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    };
  }

  /**
   * Detail view for a single customer scoped to this seller's items.
   */
  async getForSeller(
    sellerId: string,
    userId: string,
  ): Promise<SellerCustomerDetail> {
    const sellerObjectId = new Types.ObjectId(sellerId);
    const userObjectId = new Types.ObjectId(userId);

    const pipeline: PipelineStage[] = [
      { $match: { userId: userObjectId } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: '_product',
          pipeline: [{ $project: { sellerId: 1 } }],
        },
      },
      { $unwind: { path: '$_product', preserveNullAndEmptyArrays: false } },
      { $match: { '_product.sellerId': sellerObjectId } },

      // Re-aggregate items per order (scoped to this seller).
      {
        $group: {
          _id: '$_id',
          userId: { $first: '$userId' },
          orderNumber: { $first: '$orderNumber' },
          status: { $first: '$status' },
          currency: { $first: '$currency' },
          placedAt: { $first: '$placedAt' },
          createdAt: { $first: '$createdAt' },
          items: { $push: '$items' },
          sellerSubtotal: { $sum: '$items.totalPrice' },
          sellerItemCount: { $sum: '$items.quantity' },
        },
      },
      { $sort: { createdAt: -1 } },

      // Group back to the single customer summary + orders[].
      {
        $group: {
          _id: '$userId',
          orderCount: { $sum: 1 },
          lifetimeValue: { $sum: '$sellerSubtotal' },
          lastOrderAt: {
            $max: { $ifNull: ['$placedAt', '$createdAt'] },
          },
          firstOrderAt: {
            $min: { $ifNull: ['$placedAt', '$createdAt'] },
          },
          orders: {
            $push: {
              orderId: { $toString: '$_id' },
              orderNumber: '$orderNumber',
              status: '$status',
              currency: '$currency',
              placedAt: '$placedAt',
              createdAt: '$createdAt',
              sellerSubtotal: '$sellerSubtotal',
              sellerItemCount: '$sellerItemCount',
              items: {
                $map: {
                  input: '$items',
                  as: 'i',
                  in: {
                    productId: { $toString: '$$i.productId' },
                    productName: '$$i.productName',
                    variantSku: '$$i.variantSku',
                    variantName: '$$i.variantName',
                    imageUrl: '$$i.imageUrl',
                    quantity: '$$i.quantity',
                    unitPrice: '$$i.unitPrice',
                    totalPrice: '$$i.totalPrice',
                  },
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            {
              $project: {
                email: 1,
                firstName: 1,
                lastName: 1,
                isDeleted: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      { $match: { 'user.isDeleted': { $ne: true } } },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          fullName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          orderCount: 1,
          lifetimeValue: 1,
          lastOrderAt: 1,
          firstOrderAt: 1,
          orders: 1,
        },
      },
    ];

    const result = await this.orderModel.aggregate<SellerCustomerDetail>(pipeline);
    const customer = result[0];
    if (!customer) {
      throw new NotFoundException('Customer not found for this seller');
    }
    return customer;
  }

  /** Map DTO sort field → aggregation field name (1:1 today). */
  private toSortFieldKey(field: CustomerSortField): string {
    switch (field) {
      case 'lastOrderAt':
        return 'lastOrderAt';
      case 'lifetimeValue':
        return 'lifetimeValue';
      case 'orderCount':
        return 'orderCount';
      default:
        return 'lastOrderAt';
    }
  }

  /** Build the $match stage for free-text search across name / email. */
  private buildSearchMatch(search?: string): Record<string, unknown> | null {
    if (!search || !search.trim()) return null;
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = { $regex: safe, $options: 'i' };
    return {
      $or: [
        { firstName: rx },
        { lastName: rx },
        { email: rx },
        { fullName: rx },
      ],
    };
  }
}
