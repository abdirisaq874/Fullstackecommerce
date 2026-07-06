import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from '../products/schemas/product.schema';
import { User } from '../users/schemas/user.schema';
import { SellerSettings } from '../seller-settings/schemas/seller-settings.schema';

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

/** Public seller storefronts — profile + the seller's active products. */
@Injectable()
export class SellersService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(SellerSettings.name) private readonly settingsModel: Model<SellerSettings>,
  ) {}

  /** Accept either a store-profile slug or a raw seller userId. */
  private async resolveUserId(idOrSlug: string): Promise<string | null> {
    const bySlug = await this.settingsModel
      .findOne({ 'storeProfile.slug': idOrSlug })
      .select('sellerId')
      .lean();
    if (bySlug) return String((bySlug as any).sellerId);
    return OID.test(idOrSlug) ? idOrSlug : null;
  }

  async getProfile(idOrSlug: string): Promise<SellerProfile> {
    const userId = await this.resolveUserId(idOrSlug);
    if (!userId) throw new NotFoundException('Seller not found');

    const [user, settings, stats] = await Promise.all([
      this.userModel.findById(userId).select('firstName lastName avatarUrl role createdAt').lean(),
      this.settingsModel.findOne({ sellerId: new Types.ObjectId(userId) }).select('storeProfile').lean(),
      this.productModel.aggregate([
        { $match: { sellerId: new Types.ObjectId(userId), status: 'active', isDeleted: { $ne: true } } },
        { $group: { _id: null, count: { $sum: 1 }, rating: { $avg: '$avgRating' }, reviews: { $sum: '$reviewCount' } } },
      ]),
    ]);
    if (!user) throw new NotFoundException('Seller not found');

    const sp = ((settings as any)?.storeProfile ?? {}) as Record<string, any>;
    const s = (stats as any[])[0] ?? {};
    const fullName = `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim();
    return {
      id: userId,
      name: sp.displayName || fullName || 'Store',
      slug: sp.slug || null,
      logoUrl: sp.logoUrl || (user as any).avatarUrl || null,
      country: sp.country || null,
      productCount: s.count ?? 0,
      avgRating: s.rating ? Math.round(s.rating * 10) / 10 : 0,
      reviewCount: s.reviews ?? 0,
      memberSince: (user as any).createdAt,
    };
  }

  async getProducts(
    idOrSlug: string,
    opts: { page?: number; limit?: number; sortBy?: string } = {},
  ): Promise<{ data: any[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const userId = await this.resolveUserId(idOrSlug);
    if (!userId) throw new NotFoundException('Seller not found');

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(48, Math.max(1, opts.limit ?? 24));
    const filter = { sellerId: new Types.ObjectId(userId), status: 'active', isDeleted: { $ne: true } };
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
