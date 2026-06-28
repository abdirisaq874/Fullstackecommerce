import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { applySoftDeleteMiddleware } from '../../shared/database/base.schema';

// ─── Brand ───
export type BrandDocument = HydratedDocument<Brand>;

@Schema({ timestamps: true, collection: 'brands' })
export class Brand {
  @Prop({ required: true }) name: string;
  @Prop({ unique: true, index: true }) slug: string;
  @Prop() logoUrl?: string;
  @Prop() website?: string;
  @Prop() description?: string;
  @Prop({ default: true }) isActive: boolean;
}
export const BrandSchema = SchemaFactory.createForClass(Brand);

// ─── Category ───
export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: Types.ObjectId, ref: 'Category' })
  parentId?: Types.ObjectId;

  @Prop({ required: true }) name: string;
  @Prop({ unique: true, index: true }) slug: string;
  @Prop() description?: string;
  @Prop() imageUrl?: string;
  @Prop({ default: 0 }) sortOrder: number;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: 0 }) depth: number;
  @Prop({ index: true }) path: string; // "electronics.phones.android"
}
export const CategorySchema = SchemaFactory.createForClass(Category);

// ─── Product Variant (embedded) ───
@Schema({ _id: true })
export class ProductVariant {
  _id: Types.ObjectId;
  @Prop({ required: true }) sku: string;
  @Prop() name: string;
  @Prop() priceOverride?: number;
  @Prop() costPrice?: number;
  @Prop() weightGrams?: number;
  @Prop() barcode?: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: 0 }) sortOrder: number;

  @Prop({ type: [{ name: String, value: String }], default: [] })
  options: { name: string; value: string }[];
}
export const ProductVariantSchema = SchemaFactory.createForClass(ProductVariant);

// ─── Product Image (embedded) ───
@Schema({ _id: true })
export class ProductImage {
  _id: Types.ObjectId;
  @Prop({ required: true }) url: string;
  @Prop() altText?: string;
  @Prop({ type: Types.ObjectId }) variantId?: Types.ObjectId;
  @Prop({ default: false }) isPrimary: boolean;
  @Prop({ default: 0 }) sortOrder: number;
}
export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);

// ─── Main Product ───
export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true }) name: string;
  @Prop({ unique: true, index: true }) slug: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  sellerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  categoryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Brand' })
  brandId?: Types.ObjectId;

  @Prop() description?: string;
  @Prop() shortDescription?: string;

  @Prop({ required: true, type: Number }) basePrice: number;
  @Prop({ type: Number }) compareAtPrice?: number;
  @Prop({ default: 'USD' }) currency: string;

  // Simple product-level stock count (denormalized for quick display/management).
  // The Inventory module remains available for advanced multi-warehouse tracking.
  @Prop({ type: Number, default: 0, min: 0 }) stock: number;

  @Prop({ enum: ['draft', 'active', 'archived'], default: 'draft', index: true })
  status: string;

  @Prop({ default: false }) isFeatured: boolean;
  @Prop({ default: 0 }) avgRating: number;
  @Prop({ default: 0 }) reviewCount: number;
  @Prop({ default: 0 }) totalSold: number;

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants: ProductVariant[];

  @Prop({ type: [ProductImageSchema], default: [] })
  images: ProductImage[];

  @Prop({ type: [{ key: String, value: String }], default: [] })
  attributes: { key: string; value: string }[];

  @Prop() metaTitle?: string;
  @Prop() metaDescription?: string;

  // Per-locale buyer-facing text (en/tr/so/sw/am). Stored as a flexible object;
  // English remains canonical in the top-level name/description fields.
  @Prop({ type: Object })
  localizations?: Record<string, { name?: string; shortDescription?: string; description?: string }>;

  @Prop({ default: false }) isDeleted: boolean;
  @Prop() deletedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexes
ProductSchema.index({ name: 'text', description: 'text', shortDescription: 'text' });
ProductSchema.index({ categoryId: 1, status: 1, basePrice: 1 });
ProductSchema.index({ 'variants.sku': 1 });
ProductSchema.index({ sellerId: 1, status: 1 });
ProductSchema.index({ isFeatured: 1, status: 1 });
ProductSchema.index({ avgRating: -1 });
ProductSchema.index({ totalSold: -1 });
ProductSchema.index({ createdAt: -1 });

applySoftDeleteMiddleware(ProductSchema);
