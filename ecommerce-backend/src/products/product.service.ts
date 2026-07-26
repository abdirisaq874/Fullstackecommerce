import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Product, ProductDocument, Category, Brand } from './schemas/product.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { ProductNormalizationService } from './product-normalization.service';
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
    private normalization: ProductNormalizationService,
  ) {}

  // ═══════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════

  async create(
    dto: CreateProductDto,
    sellerId: string,
    extra?: Record<string, any>,
  ): Promise<ProductDocument> {
    await this.maybeNormalize(dto as any);
    const slug = await this.generateProductSlug(dto.name);

    const product = await this.productModel.create({
      ...dto,
      ...(extra || {}),
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
    await this.syncVariantStock(product._id.toString(), (dto as any).variants);

    return product;
  }

  /**
   * Persist per-variant stock to the Inventory collection (per SKU). The variant
   * sub-doc has no stock field, so this is the only place variant stock is stored.
   * Fire-and-forget via an event so Products stays decoupled from Inventory.
   */
  private async syncVariantStock(
    productId: string,
    variants?: Array<{ sku?: string; stock?: number }>,
  ): Promise<void> {
    if (!Array.isArray(variants)) return;
    const items = variants
      .filter((v) => v?.sku && typeof v.stock === 'number')
      .map((v) => ({ sku: v.sku as string, quantity: v.stock as number }));
    if (items.length) await this.eventBus.emit('product.stock_set', { productId, items });
  }

  /**
   * English-canonicalize a create payload in place (name, attributes, localizations,
   * and thus the slug) via one LLM call, so every new product is stored English —
   * the same write-back the normalize-catalog backfill uses. Products already English
   * (sourceLang=en) keep the seller's exact input. Never blocks creation: on failure
   * or when disabled the product is stored as-is and left for the backfill to retry.
   */
  private async maybeNormalize(dto: any): Promise<void> {
    if (!this.normalization.enabled || !dto?.name?.trim()) return;
    try {
      const n = await this.normalization.normalize({
        name: dto.name,
        shortDescription: dto.shortDescription,
        description: dto.description,
        attributes: dto.attributes,
      });
      if (!n) return; // failed → leave unmarked; backfill retries later
      if (n.sourceLang && n.sourceLang !== 'en') {
        this.normalization.applyNormalization(dto, n);
      } else {
        dto.normalizedAt = new Date(); // already English — mark processed, keep input
      }
    } catch {
      /* never block product creation on the LLM */
    }
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
        await this.maybeNormalize(dto as any);
        const slug = await this.generateProductSlug(dto.name);
        const product = await this.productModel.create({
          ...dto,
          slug,
          sellerId: new Types.ObjectId(sellerId),
          categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
          brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : undefined,
        });
        // Bulk path previously skipped BOTH indexing and per-SKU stock: wire the
        // same product.created event (→ index) + variant-stock sync as create().
        await this.eventBus.emit('product.created', {
          productId: product._id.toString(),
          name: product.name,
          sellerId,
        });
        await this.syncVariantStock(product._id.toString(), (dto as any).variants);
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
  async findByIdOrSlug(idOrSlug: string): Promise<any> {
    const filter = Types.ObjectId.isValid(idOrSlug)
      ? { _id: new Types.ObjectId(idOrSlug) }
      : { slug: idOrSlug };

    const product = await this.productModel
      .findOne({ ...filter, status: 'active' })
      .populate('categoryId', 'name slug path')
      .populate('brandId', 'name slug logoUrl');

    if (!product) throw new NotFoundException('Product not found');

    // Category breadcrumb trail (root→leaf). The category's `path` is a dot-
    // separated slug chain (e.g. "apparel-and-accessories.shoes"); resolve every
    // slug to its display name in one query so the storefront can render the
    // full hierarchy without fetching the whole (5k+ node) taxonomy.
    const cat = product.categoryId as any;
    let categoryTrail: { name: string; slug: string }[] = [];
    if (cat?.path) {
      const slugs = String(cat.path).split('.').filter(Boolean);
      const cats = await this.categoryModel
        .find({ slug: { $in: slugs } })
        .select('name slug')
        .lean();
      const nameBySlug = new Map(cats.map((c: any) => [c.slug, c.name]));
      categoryTrail = slugs
        .filter((s) => nameBySlug.has(s))
        .map((s) => ({ name: nameBySlug.get(s) as string, slug: s }));
    }

    const result = product.toJSON() as any;
    result.categoryTrail = categoryTrail;
    return result;
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
    await this.syncVariantStock(id, (dto as any).variants);

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
    // Store-scoped: non-admins can only touch products of the active store
    // (`actorId` is the active store id); admins can touch any.
    const filter: FilterQuery<Product> = {
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      ...(role === 'admin' ? {} : { sellerId: new Types.ObjectId(actorId) }),
    };

    const result = await this.productModel.updateMany(filter, { $set: patch });

    await this.eventBus.emit('products.bulk_updated', {
      ids,
      changes: Object.keys(patch),
      actorId,
    });

    return { matched: result.matchedCount, modified: result.modifiedCount };
  }

  /**
   * Maintenance: strip trailing commas/whitespace from stored product image
   * URLs. Some bulk-imported images were saved as ".../image.jpg," (trailing
   * comma) and 404 — breaking colour swatches and thumbnails. Store-scoped:
   * non-admins only clean the active store's products; admins clean all.
   * Idempotent — safe to run repeatedly.
   */
  async cleanImageUrls(
    storeId: string,
    role?: string,
  ): Promise<{ scanned: number; changed: number; cleaned: number }> {
    const clean = (u: unknown): string =>
      String(u ?? '').trim().replace(/[;,]+$/, '').trim();

    const filter: FilterQuery<Product> = {
      'images.0': { $exists: true },
      ...(role === 'admin' ? {} : { sellerId: new Types.ObjectId(storeId) }),
    };

    let scanned = 0;
    let changed = 0;
    let cleaned = 0;
    const cursor = this.productModel.find(filter, { images: 1 }).lean().cursor();

    for await (const p of cursor) {
      scanned++;
      const images: any[] = Array.isArray((p as any).images) ? (p as any).images : [];
      let dirty = false;
      const next: any[] = [];
      for (const img of images) {
        const original = String(img?.url ?? '');
        const url = clean(original);
        if (url !== original) {
          dirty = true;
          cleaned++;
        }
        if (!/^https?:\/\//i.test(url)) {
          // only reachable if the URL was already junk (never from a comma strip)
          dirty = true;
          continue;
        }
        next.push({ ...img, url });
      }
      if (!dirty) continue;
      if (next.length && !next.some((i) => i.isPrimary)) next[0].isPrimary = true;
      next.forEach((i, idx) => {
        i.sortOrder = idx;
      });
      changed++;
      await this.productModel.updateOne({ _id: (p as any)._id }, { $set: { images: next } });
    }

    return { scanned, changed, cleaned };
  }

  async getFeatured(limit: number = 12): Promise<ProductDocument[]> {
    return this.productModel
      .find({ status: 'active', isFeatured: true })
      .populate('brandId', 'name slug')
      .sort({ totalSold: -1 })
      .limit(limit);
  }

  /**
   * Cursor over every feed-eligible product for external catalog feeds
   * (Meta Commerce / Google Merchant). Active-only. Brand/category are resolved
   * by the caller via getFeedBrandMap()/getFeedCategoryMap() rather than
   * populate() — populate on a cursor issues a query per document (N+1), which
   * made feed generation take ~a minute. `.lean().cursor()` streams so a large
   * catalog is never held in memory all at once.
   */
  findActiveForFeedCursor() {
    return this.productModel.find({ status: 'active' }).lean().cursor();
  }

  /** id→name map of all brands, for O(1) brand lookup during feed generation. */
  async getFeedBrandMap(): Promise<Map<string, string>> {
    const brands = await this.brandModel.find().select('name').lean();
    return new Map(brands.map((b: any) => [String(b._id), b.name]));
  }

  /** id→{name,googleTaxonomyId} map of all categories, for feed generation. */
  async getFeedCategoryMap(): Promise<
    Map<string, { name: string; googleTaxonomyId?: number }>
  > {
    const cats = await this.categoryModel
      .find()
      .select('name googleTaxonomyId')
      .lean();
    return new Map(
      cats.map((c: any) => [
        String(c._id),
        { name: c.name, googleTaxonomyId: c.googleTaxonomyId },
      ]),
    );
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
