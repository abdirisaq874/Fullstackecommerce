import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';

import { Product } from '../products/schemas/product.schema';
import { Order } from '../orders/schemas/order.schema';
import { MessageThread } from '../messages/schemas/message-thread.schema';

export type SearchType = 'all' | 'product' | 'order' | 'message';

export interface SearchResult {
  type: 'product' | 'order' | 'message';
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

/**
 * Escape a user-supplied query string so it can safely be embedded in a RegExp.
 * Without this, characters like `.`, `*`, `(` etc. would be interpreted as
 * regex meta-characters and could blow up the query or match unintended docs.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(MessageThread.name)
    private readonly threadModel: Model<MessageThread>,
  ) {}

  async search(
    sellerId: string,
    q: string,
    type: SearchType = 'all',
    limit = 10,
  ): Promise<SearchResponse> {
    const trimmed = q?.trim();
    if (!trimmed) return { results: [] };

    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit) || 10));
    const sellerObjectId = new Types.ObjectId(sellerId);
    const regex = new RegExp(escapeRegex(trimmed), 'i');

    const tasks: Array<Promise<SearchResult[]>> = [];
    if (type === 'all' || type === 'product') {
      tasks.push(this.searchProducts(sellerObjectId, regex, safeLimit));
    }
    if (type === 'all' || type === 'order') {
      tasks.push(this.searchOrders(sellerObjectId, regex, safeLimit));
    }
    if (type === 'all' || type === 'message') {
      tasks.push(this.searchMessages(sellerObjectId, regex, safeLimit));
    }

    const groups = await Promise.all(tasks);
    const combined = groups.flat().slice(0, safeLimit);
    return { results: combined };
  }

  private async searchProducts(
    sellerId: Types.ObjectId,
    regex: RegExp,
    limit: number,
  ): Promise<SearchResult[]> {
    const docs = await this.productModel
      .find({ sellerId, name: regex, isDeleted: { $ne: true } })
      .select({ _id: 1, name: 1, slug: 1 })
      .limit(limit)
      .lean()
      .exec();

    return docs.map((p) => ({
      type: 'product' as const,
      id: String(p._id),
      title: p.name,
      subtitle: p.slug,
      url: `/products/${String(p._id)}/edit`,
    }));
  }

  /**
   * Orders don't carry sellerId on their line items, so we resolve seller
   * ownership by joining each item to its product. An order matches if its
   * orderNumber matches the query AND at least one item belongs to a product
   * owned by this seller.
   */
  private async searchOrders(
    sellerId: Types.ObjectId,
    regex: RegExp,
    limit: number,
  ): Promise<SearchResult[]> {
    const pipeline: PipelineStage[] = [
      { $match: { orderNumber: { $regex: regex } } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: '_products',
          pipeline: [{ $project: { sellerId: 1 } }],
        },
      },
      { $match: { '_products.sellerId': sellerId } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      { $project: { _id: 1, orderNumber: 1, status: 1 } },
    ];

    const docs = await this.orderModel.aggregate(pipeline).exec();
    return docs.map((o) => ({
      type: 'order' as const,
      id: String(o._id),
      title: o.orderNumber,
      subtitle: o.status,
      url: `/orders/${String(o._id)}`,
    }));
  }

  private async searchMessages(
    sellerId: Types.ObjectId,
    regex: RegExp,
    limit: number,
  ): Promise<SearchResult[]> {
    const docs = await this.threadModel
      .find({
        sellerId,
        isDeleted: { $ne: true },
        $or: [{ subject: regex }, { lastMessagePreview: regex }],
      })
      .select({ _id: 1, subject: 1, lastMessagePreview: 1 })
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return docs.map((t) => ({
      type: 'message' as const,
      id: String(t._id),
      title: t.subject,
      subtitle: t.lastMessagePreview,
      url: `/messages/${String(t._id)}`,
    }));
  }
}
