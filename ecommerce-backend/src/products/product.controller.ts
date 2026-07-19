import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { ProductAiService } from './product-ai.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { StoreScoped, ActiveStore } from '../stores/guards/store-context.guard';
import { StoreRole } from '../stores/schemas/store-membership.schema';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import {
  CreateProductDto, UpdateProductDto, ProductQueryDto,
  CreateCategoryDto, CreateBrandDto, BulkUpdateProductsDto, BulkCreateProductsDto,
} from './dto/product.dto';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productAi: ProductAiService,
  ) {}

  @Post('ai/draft')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'AI: draft copy + auto-assign category from product details (+image)' })
  async aiDraft(
    @Body()
    dto: {
      name: string;
      brief?: string;
      brand?: string;
      attributes?: { key: string; value: string }[];
      imageUrl?: string;
    },
  ) {
    return this.productAi.draft(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search & filter products' })
  async search(@Query() query: ProductQueryDto) {
    return this.productService.search(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured products' })
  async getFeatured(@Query('limit') limit?: number) {
    return this.productService.getFeatured(limit);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a product by id or slug' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.productService.findByIdOrSlug(idOrSlug);
  }

  @Post()
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Create a product in the active store' })
  async create(
    @Body() dto: CreateProductDto,
    @ActiveStore('storeId') storeId: string,
  ) {
    return this.productService.create(dto, storeId);
  }

  @Post('bulk-update')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Update many products at once (status / featured)' })
  async bulkUpdate(
    @Body() dto: BulkUpdateProductsDto,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.productService.bulkUpdate(dto.ids, dto.patch, storeId, role);
  }

  @Post('bulk-create')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Create many products in one request (bulk import)' })
  async bulkCreate(
    @Body() dto: BulkCreateProductsDto,
    @ActiveStore('storeId') storeId: string,
  ) {
    return this.productService.bulkCreate(dto.products, storeId);
  }

  @Patch(':id')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Update a product in the active store' })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.productService.update(id, dto, storeId, role);
  }

  @Delete(':id')
  @StoreScoped(StoreRole.STAFF)
  @ApiOperation({ summary: 'Archive a product in the active store' })
  async archive(
    @Param('id', ParseObjectIdPipe) id: string,
    @ActiveStore('storeId') storeId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.productService.archive(id, storeId, role);
  }
}

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Get category tree' })
  async getTree(@Query('depth') depth?: string) {
    return this.productService.getCategoryTree(
      depth !== undefined && depth !== '' ? Number(depth) : undefined,
    );
  }

  @Post()
  @Auth('admin')
  @ApiOperation({ summary: 'Create category' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.productService.createCategory(dto);
  }
}

@ApiTags('brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'List all brands' })
  async list() {
    return this.productService.getBrands();
  }

  @Post()
  @Auth('admin')
  @ApiOperation({ summary: 'Create brand' })
  async create(@Body() dto: CreateBrandDto) {
    return this.productService.createBrand(dto);
  }
}
