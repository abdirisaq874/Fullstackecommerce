import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import {
  CreateProductDto, UpdateProductDto, ProductQueryDto,
  CreateCategoryDto, CreateBrandDto, BulkUpdateProductsDto, BulkCreateProductsDto,
} from './dto/product.dto';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

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
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Create a product' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.productService.create(dto, userId);
  }

  @Post('bulk-update')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Update many products at once (status / featured)' })
  async bulkUpdate(
    @Body() dto: BulkUpdateProductsDto,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.productService.bulkUpdate(dto.ids, dto.patch, userId, role);
  }

  @Post('bulk-create')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Create many products in one request (bulk import)' })
  async bulkCreate(
    @Body() dto: BulkCreateProductsDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.productService.bulkCreate(dto.products, userId);
  }

  @Patch(':id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.productService.update(id, dto, userId, role);
  }

  @Delete(':id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Archive a product' })
  async archive(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.productService.archive(id, userId, role);
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
