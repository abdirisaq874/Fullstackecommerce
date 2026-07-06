import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Order } from '../orders/schemas/order.schema';
import { RetrievalService } from '../search-engine/retrieval/retrieval.service';

const CARD_FIELDS = 'name slug basePrice compareAtPrice currency images avgRating reviewCount totalSold isFeatured categoryId brandId localizations status';
const NON_SELLABLE = ['cancelled', 'refunded'];

/**
 * Product recommendations:
 *  - related(): semantically similar items (vector k-NN, falls back to category)
 *  - frequentlyBoughtTogether(): market-basket co-purchase from orders
 *  - forYou(): personalized from the user's purchase + recently-viewed signal
 */
@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    private readonly retrieval: RetrievalService,
  ) {}

  /** Fetch active products by id, preserving the given order. */
  private async byIds(ids: string[]): Promise<any[]> {
    if (!ids.length) return [];
    const docs = await this.productModel
      .find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) }, status: 'active', isDeleted: { $ne: true } })
      .select(CARD_FIELDS)
      .lean();
    const rank = new Map(ids.map((id, i) => [id, i]));
    return docs.sort((a: any, b: any) => (rank.get(String(a._id)) ?? 999) - (rank.get(String(b._id)) ?? 999));
  }

  private async categoryPopular(categoryId: any, excludeIds: string[], limit: number): Promise<any[]> {
    if (!categoryId) return [];
    return this.productModel
      .find({
        categoryId,
        status: 'active',
        isDeleted: { $ne: true },
        _id: { $nin: excludeIds.map((i) => new Types.ObjectId(i)) },
      })
      .select(CARD_FIELDS)
      .sort({ totalSold: -1, avgRating: -1 })
      .limit(limit)
      .lean();
  }

  /** Similar products — semantic vector k-NN, category-popularity fallback. */
  async related(productId: string, limit = 8): Promise<any[]> {
    const product = await this.productModel.findById(productId).select('embedding categoryId').lean();
    if (!product) return [];

    const emb = (product as any).embedding as number[] | undefined;
    if (Array.isArray(emb) && emb.length) {
      try {
        const hits = await this.retrieval.similar(emb, limit, productId);
        const ids = hits.map((h) => h.id);
        const docs = await this.byIds(ids);
        if (docs.length) return docs;
      } catch (e) {
        this.logger.warn(`related kNN failed, using category fallback: ${(e as Error).message}`);
      }
    }
    return this.categoryPopular((product as any).categoryId, [productId], limit);
  }

  /** Frequently bought together — products co-occurring in the same orders. */
  async frequentlyBoughtTogether(productId: string, limit = 6): Promise<any[]> {
    const pid = new Types.ObjectId(productId);
    const rows = await this.orderModel.aggregate([
      { $match: { 'items.productId': pid, status: { $nin: NON_SELLABLE } } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $ne: pid } } },
      { $group: { _id: '$items.productId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    const ids = rows.map((r: any) => String(r._id));
    return this.byIds(ids);
  }

  /**
   * Personalized "For you". Signal = categories of the user's past purchases +
   * any recently-viewed product ids passed from the client. Recommends popular
   * active products in those categories (excluding already seen); falls back to
   * store-wide trending when there is no signal yet.
   */
  async forYou(userId: string | undefined, recentlyViewedIds: string[] = [], limit = 12): Promise<any[]> {
    const seen = new Set<string>(recentlyViewedIds);
    const categoryIds = new Set<string>();

    // Purchase history → categories + seen ids
    if (userId) {
      const orders = await this.orderModel
        .find({ userId: new Types.ObjectId(userId), status: { $nin: NON_SELLABLE } })
        .select('items.productId')
        .lean();
      for (const o of orders as any[]) for (const it of o.items || []) seen.add(String(it.productId));
    }

    // Recently-viewed + purchased products → their categories
    if (seen.size) {
      const seedProducts = await this.productModel
        .find({ _id: { $in: [...seen].map((i) => new Types.ObjectId(i)) } })
        .select('categoryId')
        .lean();
      for (const p of seedProducts as any[]) if (p.categoryId) categoryIds.add(String(p.categoryId));
    }

    const excludeIds = [...seen].map((i) => new Types.ObjectId(i));

    if (categoryIds.size) {
      const recs = await this.productModel
        .find({
          categoryId: { $in: [...categoryIds].map((i) => new Types.ObjectId(i)) },
          status: 'active',
          isDeleted: { $ne: true },
          _id: { $nin: excludeIds },
        })
        .select(CARD_FIELDS)
        .sort({ totalSold: -1, avgRating: -1 })
        .limit(limit)
        .lean();
      if (recs.length >= Math.min(4, limit)) return recs;
      // Not enough in-category → top up with trending below.
      const have = new Set(recs.map((r: any) => String(r._id)));
      const trending = await this.trending(limit - recs.length, [...excludeIds, ...[...have].map((i) => new Types.ObjectId(i))]);
      return [...recs, ...trending];
    }

    return this.trending(limit, excludeIds);
  }

  private async trending(limit: number, excludeIds: Types.ObjectId[] = []): Promise<any[]> {
    if (limit <= 0) return [];
    return this.productModel
      .find({ status: 'active', isDeleted: { $ne: true }, _id: { $nin: excludeIds } })
      .select(CARD_FIELDS)
      .sort({ totalSold: -1, avgRating: -1, reviewCount: -1 })
      .limit(limit)
      .lean();
  }
}
