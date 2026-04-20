import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { Auth, CurrentUser } from '../auth/guards/auth.guards';
import { ParseObjectIdPipe } from '../shared/pipes/parse-objectid.pipe';
import {
  CreateProductDto, UpdateProductDto, ProductQueryDto,
  CreateCategoryDto, CreateBrandDto,
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

  @Get(':slug')
  @ApiOperation({ summary: 'Get product by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
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

  @Patch(':id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Auth('admin', 'seller')
  @ApiOperation({ summary: 'Archive a product' })
  async archive(@Param('id', ParseObjectIdPipe) id: string) {
    return this.productService.archive(id);
  }
}

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Get category tree' })
  async getTree() {
    return this.productService.getCategoryTree();
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
