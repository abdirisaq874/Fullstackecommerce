import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { Store, StoreStatus } from '../stores/schemas/store.schema';

const CARD_FIELDS = 'name slug basePrice compareAtPrice currency images avgRating reviewCount totalSold isFeatured categoryId brandId localizations status';
const OID = /^[a-f0-9]{24}$/i;

export interface SellerProfile {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  country: string | null;
  productCount: number;
  avgRating: number;
  reviewCount: number;
  memberSince?: Date;
}

/** Public store storefronts — profile + the store's active products. */
@Injectable()
export class SellersService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Store.name) private readonly storeModel: Model<Store>,
  ) {}

  /** Resolve an ACTIVE store by its slug or its id. Products carry storeId as `sellerId`. */
  private async resolveStore(idOrSlug: string): Promise<any | null> {
    const bySlug = await this.storeModel
      .findOne({ slug: idOrSlug, status: StoreStatus.ACTIVE })
      .lean();
    if (bySlug) return bySlug;
    if (OID.test(idOrSlug)) {
      return this.storeModel.findOne({ _id: new Types.ObjectId(idOrSlug), status: StoreStatus.ACTIVE }).lean();
    }
    return null;
  }

  async getProfile(idOrSlug: string): Promise<SellerProfile> {
    const store = await this.resolveStore(idOrSlug);
    if (!store) throw new NotFoundException('Store not found');
    const storeId = store._id;

    const stats = await this.productModel.aggregate([
      { $match: { sellerId: new Types.ObjectId(storeId), status: 'active', isDeleted: { $ne: true } } },
      { $group: { _id: null, count: { $sum: 1 }, rating: { $avg: '$avgRating' }, reviews: { $sum: '$reviewCount' } } },
    ]);
    const s = (stats as any[])[0] ?? {};
    return {
      id: String(storeId),
      name: store.displayName || 'Store',
      slug: store.slug || null,
      logoUrl: store.logoUrl || null,
      country: store.country || null,
      productCount: s.count ?? 0,
      avgRating: s.rating ? Math.round(s.rating * 10) / 10 : 0,
      reviewCount: s.reviews ?? 0,
      memberSince: store.createdAt,
    };
  }

  async getProducts(
    idOrSlug: string,
    opts: { page?: number; limit?: number; sortBy?: string } = {},
  ): Promise<{ data: any[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const store = await this.resolveStore(idOrSlug);
    if (!store) throw new NotFoundException('Store not found');

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(48, Math.max(1, opts.limit ?? 24));
    const filter = { sellerId: new Types.ObjectId(store._id), status: 'active', isDeleted: { $ne: true } };
    const sort: Record<string, 1 | -1> =
      opts.sortBy === 'newest' ? { createdAt: -1 }
        : opts.sortBy === 'price_asc' ? { basePrice: 1 }
          : opts.sortBy === 'price_desc' ? { basePrice: -1 }
            : opts.sortBy === 'rating' ? { avgRating: -1, reviewCount: -1 }
              : { totalSold: -1, avgRating: -1 };

    const [data, total] = await Promise.all([
      this.productModel.find(filter).select(CARD_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      this.productModel.countDocuments(filter),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
