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

  async findBySlug(slug: string): Promise<ProductDocument> {
    const product = await this.productModel
      .findOne({ slug, status: 'active' })
      .populate('categoryId', 'name slug path')
      .populate('brandId', 'name slug logoUrl');

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findById(id: string): Promise<ProductDocument> {
    const product = await this.productModel
      .findById(id)
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

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    const product = await this.productModel.findByIdAndUpdate(
      id,
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

  async archive(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { $set: { status: 'archived' } },
      { new: true },
    );
    if (!product) throw new NotFoundException('Product not found');

    await this.eventBus.emit('product.archived', { productId: id });
    return product;
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

  async getCategoryTree(): Promise<any[]> {
    const categories = await this.categoryModel
      .find({ isActive: true })
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
