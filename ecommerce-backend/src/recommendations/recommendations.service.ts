import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Order } from '../orders/schemas/order.schema';
import { UserInteraction } from './schemas/user-interaction.schema';
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
    @InjectModel(UserInteraction.name) private readonly interactionModel: Model<UserInteraction>,
    private readonly retrieval: RetrievalService,
  ) {}

  /**
   * Record a behavioural signal (view / cart / purchase). Upserts one row per
   * (user, product, type) and refreshes updatedAt so recency reflects the last
   * touch. No-op for guests (no userId) — they rely on client recently-viewed.
   */
  async recordInteraction(
    userId: string | undefined,
    productId: string,
    type: 'view' | 'cart' | 'purchase',
  ): Promise<void> {
    if (!userId || !productId || !Types.ObjectId.isValid(productId)) return;
    try {
      const p = await this.productModel.findById(productId).select('categoryId').lean();
      await this.interactionModel.updateOne(
        { userId: new Types.ObjectId(userId), productId: new Types.ObjectId(productId), type },
        { $set: { categoryId: (p as any)?.categoryId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
    } catch (e) {
      this.logger.warn(`recordInteraction failed: ${(e as Error).message}`);
    }
  }

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
    const WEIGHT: Record<string, number> = { purchase: 5, cart: 3, view: 1 };
    const seen = new Set<string>(recentlyViewedIds);
    const catScore = new Map<string, number>();
    const bump = (cat: any, by: number) => {
      if (!cat) return;
      const k = String(cat);
      catScore.set(k, (catScore.get(k) || 0) + by);
    };

    // 1) Persistent behavioural profile: this user's views/cart/purchases, most
    //    recent first, weighted by type × recency. This is the "learned" signal.
    if (userId && Types.ObjectId.isValid(userId)) {
      const ix = await this.interactionModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
      ix.forEach((r: any, i) => {
        seen.add(String(r.productId));
        const recency = 1 / (1 + i * 0.05); // newer interactions weigh more
        bump(r.categoryId, (WEIGHT[r.type] || 1) * recency);
      });
    }

    // 2) Client recently-viewed (this session/device) → light category signal.
    //    Also covers guests, who have no server profile yet.
    if (recentlyViewedIds.length) {
      const seed = await this.productModel
        .find({ _id: { $in: recentlyViewedIds.filter((i) => Types.ObjectId.isValid(i)).map((i) => new Types.ObjectId(i)) } })
        .select('categoryId')
        .lean();
      for (const p of seed as any[]) bump(p.categoryId, 1);
    }

    const topCats = [...catScore.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => new Types.ObjectId(c));
    const excludeIds = [...seen].filter((i) => Types.ObjectId.isValid(i)).map((i) => new Types.ObjectId(i));

    // 3) Best-selling active products in the user's affinity categories, minus
    //    what they've already seen/bought; top up with trending if thin.
    if (topCats.length) {
      const recs = await this.productModel
        .find({ categoryId: { $in: topCats }, status: 'active', isDeleted: { $ne: true }, _id: { $nin: excludeIds } })
        .select(CARD_FIELDS)
        .sort({ totalSold: -1, avgRating: -1 })
        .limit(limit)
        .lean();
      if (recs.length >= Math.min(4, limit)) return recs;
      const have = new Set(recs.map((r: any) => String(r._id)));
      const trending = await this.trending(limit - recs.length, [
        ...excludeIds,
        ...[...have].map((i) => new Types.ObjectId(i)),
      ]);
      return [...recs, ...trending];
    }

    // 4) Cold start (no signal) → store-wide trending.
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
