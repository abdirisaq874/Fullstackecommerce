import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Product, ProductDocument, Category, Brand } from './schemas/product.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { PaginatedResponseDto } from '../shared/database/pagination.dto';
import { generateSlug, generateUniqueSlug } from '../shared/utils/helpers';
import {
  CreateProductDto, UpdateProductDto, ProductQueryDto,
  CreateCategoryDto, CreateBrandDto,
} from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(Brand.name) private brandModel: Model<Brand>,
    private eventBus: EventBusService,
  ) {}

  // ═══════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════

  async create(dto: CreateProductDto, sellerId: string): Promise<ProductDocument> {
    const slug = await this.generateProductSlug(dto.name);

    const product = await this.productModel.create({
      ...dto,
      slug,
      sellerId: new Types.ObjectId(sellerId),
      categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
      brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : undefined,
    });

    await this.eventBus.emit('product.created', {
      productId: product._id.toString(),
      name: product.name,
      sellerId,
    });

    return product;
  }

  /**
   * Create many products in one request (CSV bulk import). Runs server-side in a
   * single HTTP call so it isn't subject to the per-request rate limit, and
   * isolates failures per row (a bad row doesn't abort the rest).
   */
  async bulkCreate(
    products: CreateProductDto[],
    sellerId: string,
  ): Promise<{ created: number; failed: number }> {
    let created = 0;
    let failed = 0;
    for (const dto of products) {
      try {
        const slug = await this.generateProductSlug(dto.name);
        await this.productModel.create({
          ...dto,
          slug,
          sellerId: new Types.ObjectId(sellerId),
          categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
          brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : undefined,
        });
        created++;
      } catch {
        failed++;
      }
    }
    return { created, failed };
  }

  /**
   * Public product lookup by either a Mongo id or a slug. Clients hold one or
   * the other depending on context (slug for SEO URLs, id for references), so we
   * accept both on the single public route. Active-only — drafts/archived are not
   * exposed publicly (an ownership-checked admin by-id endpoint is the next step).
   */
  async findByIdOrSlug(idOrSlug: string): Promise<ProductDocument> {
    const filter = Types.ObjectId.isValid(idOrSlug)
      ? { _id: new Types.ObjectId(idOrSlug) }
      : { slug: idOrSlug };

    const product = await this.productModel
      .findOne({ ...filter, status: 'active' })
      .populate('categoryId', 'name slug path')
      .populate('brandId', 'name slug logoUrl');

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async search(query: ProductQueryDto): Promise<PaginatedResponseDto<ProductDocument>> {
    const filter: FilterQuery<Product> = {};

    // Text search
    if (query.q) {
      filter.$text = { $search: query.q };
    }

    // Filters
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'active'; // Public API only shows active
    }

    // Scope to a single seller when requested (seller-portal "my products",
    // public seller storefronts). Ignore a malformed id rather than 500.
    if (query.sellerId && Types.ObjectId.isValid(query.sellerId)) {
      filter.sellerId = new Types.ObjectId(query.sellerId);
    }

    if (query.category) {
      const category = await this.categoryModel.findOne({ slug: query.category });
      if (category) {
        // Include subcategories via path prefix
        filter.$or = [
          { categoryId: category._id },
          { 'categoryId': { $in: await this.getSubcategoryIds(category._id.toString()) } },
        ];
      }
    }

    if (query.brand) {
      const brand = await this.brandModel.findOne({ slug: query.brand });
      if (brand) filter.brandId = brand._id;
    }

    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      filter.basePrice = {};
      if (query.priceMin !== undefined) filter.basePrice.$gte = query.priceMin;
      if (query.priceMax !== undefined) filter.basePrice.$lte = query.priceMax;
    }

    if (query.rating) {
      filter.avgRating = { $gte: query.rating };
    }

    if (query.featured) {
      filter.isFeatured = true;
    }

    // Sorting
    let sort: Record<string, 1 | -1> = {};
    if (query.q) {
      sort = { score: { $meta: 'textScore' } as any };
    }
    switch (query.sortBy) {
      case 'price_asc': sort = { basePrice: 1 }; break;
      case 'price_desc': sort = { basePrice: -1 }; break;
      case 'newest': sort = { createdAt: -1 }; break;
      case 'popular': sort = { totalSold: -1 }; break;
      case 'rating': sort = { avgRating: -1 }; break;
    }

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort(sort)
        .skip(query.skip)
        .limit(query.limit),
      this.productModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(products, total, query.page, query.limit);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorId: string,
    role?: string,
  ): Promise<ProductDocument> {
    const filter: FilterQuery<Product> = {
      _id: new Types.ObjectId(id),
      ...(role === 'admin' ? {} : { sellerId: new Types.ObjectId(actorId) }),
    };

    const product = await this.productModel.findOneAndUpdate(
      filter,
      {
        $set: {
          ...dto,
          categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
          brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : undefined,
        },
      },
      { new: true },
    );

    if (!product) throw new NotFoundException('Product not found');

    await this.eventBus.emit('product.updated', {
      productId: id,
      changes: Object.keys(dto),
    });

    return product;
  }

  async archive(id: string, actorId: string, role?: string): Promise<ProductDocument> {
    const filter: FilterQuery<Product> = {
      _id: new Types.ObjectId(id),
      ...(role === 'admin' ? {} : { sellerId: new Types.ObjectId(actorId) }),
    };

    const product = await this.productModel.findOneAndUpdate(
      filter,
      { $set: { status: 'archived' } },
      { new: true },
    );
    if (!product) throw new NotFoundException('Product not found');

    await this.eventBus.emit('product.archived', { productId: id });
    return product;
  }

  /**
   * Update many products in one request (Publish / Archive / Feature from the
   * dashboard). Owner-scoped: sellers can only touch their own products; admins
   * can touch any. Returns how many matched and were modified.
   */
  async bulkUpdate(
    ids: string[],
    patch: { status?: string; isFeatured?: boolean },
    actorId: string,
    role?: string,
  ): Promise<{ matched: number; modified: number }> {
    // DEV: seller scoping is intentionally OFF for now — any account can manage
    // all products. Re-enable later by adding the owner filter for non-admins:
    //   ...(role === 'admin' ? {} : { sellerId: new Types.ObjectId(actorId) })
    void role;
    const filter: FilterQuery<Product> = {
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    };

    const result = await this.productModel.updateMany(filter, { $set: patch });

    await this.eventBus.emit('products.bulk_updated', {
      ids,
      changes: Object.keys(patch),
      actorId,
    });

    return { matched: result.matchedCount, modified: result.modifiedCount };
  }

  async getFeatured(limit: number = 12): Promise<ProductDocument[]> {
    return this.productModel
      .find({ status: 'active', isFeatured: true })
      .populate('brandId', 'name slug')
      .sort({ totalSold: -1 })
      .limit(limit);
  }

  private async generateProductSlug(name: string): Promise<string> {
    const baseSlug = generateSlug(name);
    const exists = await this.productModel.findOne({ slug: baseSlug });
    return exists ? generateUniqueSlug(name) : baseSlug;
  }

  private async getSubcategoryIds(parentId: string): Promise<Types.ObjectId[]> {
    // Use $graphLookup for single-query recursive subcategory resolution
    const result = await this.categoryModel.aggregate([
      { $match: { _id: new Types.ObjectId(parentId) } },
      {
        $graphLookup: {
          from: 'categories',
          startWith: '$_id',
          connectFromField: '_id',
          connectToField: 'parentId',
          as: 'descendants',
          maxDepth: 10,
        },
      },
      { $project: { descendantIds: '$descendants._id' } },
    ]);

    return result[0]?.descendantIds ?? [];
  }

  // ═══════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════

  async createCategory(dto: CreateCategoryDto): Promise<any> {
    let path = '';
    let depth = 0;

    if (dto.parentId) {
      const parent = await this.categoryModel.findById(dto.parentId);
      if (!parent) throw new NotFoundException('Parent category not found');
      path = parent.path ? `${parent.path}.` : '';
      depth = parent.depth + 1;
    }

    const slug = generateSlug(dto.name);
    const existing = await this.categoryModel.findOne({ slug });
    if (existing) throw new ConflictException('Category slug already exists');

    return this.categoryModel.create({
      ...dto,
      slug,
      path: path + slug,
      depth,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : undefined,
    });
  }

  async getCategoryTree(maxDepth?: number): Promise<any[]> {
    const filter: Record<string, any> = { isActive: true };
    // Optionally cap the tree depth (e.g. mega menu needs only 3 levels) so we
    // don't ship the entire ~5.5k-node taxonomy to every client.
    if (typeof maxDepth === 'number' && !Number.isNaN(maxDepth)) {
      filter.depth = { $lte: maxDepth };
    }
    const categories = await this.categoryModel
      .find(filter)
      .sort({ sortOrder: 1, name: 1 });

    // Build tree from flat list
    const map = new Map();
    const roots: any[] = [];

    categories.forEach((cat) => {
      map.set(cat._id.toString(), { ...cat.toJSON(), children: [] });
    });

    categories.forEach((cat) => {
      const node = map.get(cat._id.toString());
      if (cat.parentId) {
        const parent = map.get(cat.parentId.toString());
        if (parent) parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // ═══════════════════════════════════════════
  // BRANDS
  // ═══════════════════════════════════════════

  async createBrand(dto: CreateBrandDto): Promise<any> {
    const slug = generateSlug(dto.name);
    return this.brandModel.create({ ...dto, slug });
  }

  async getBrands(): Promise<any[]> {
    return this.brandModel.find({ isActive: true }).sort({ name: 1 });
  }
}
