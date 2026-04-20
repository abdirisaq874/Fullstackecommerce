// ─── API Response Envelope ───
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ─── Auth ───
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

// ─── User ───
export type UserRole = "customer" | "seller" | "admin";

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  addresses: Address[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  _id: string;
  type: "shipping" | "billing";
  isDefault: boolean;
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

// ─── Product ───
export type ProductStatus = "draft" | "active" | "archived";

export interface VariantOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  _id?: string;
  sku: string;
  name: string;
  priceOverride?: number;
  costPrice?: number;
  weightGrams?: number;
  barcode?: string;
  isActive: boolean;
  sortOrder: number;
  options: VariantOption[];
}

export interface ProductImage {
  _id?: string;
  url: string;
  altText?: string;
  variantId?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  sellerId: string;
  categoryId?: string | Category;
  brandId?: string | Brand;
  description?: string;
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  currency: string;
  status: ProductStatus;
  isFeatured: boolean;
  avgRating: number;
  reviewCount: number;
  totalSold: number;
  variants: ProductVariant[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  categoryId?: string;
  brandId?: string;
  description?: string;
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  currency?: string;
  status?: ProductStatus;
  isFeatured?: boolean;
  variants?: Omit<ProductVariant, "_id">[];
  images?: Omit<ProductImage, "_id">[];
  attributes?: ProductAttribute[];
  metaTitle?: string;
  metaDescription?: string;
}

export interface ProductQueryParams {
  q?: string;
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  inStock?: boolean;
  featured?: boolean;
  status?: ProductStatus;
  sortBy?: "price_asc" | "price_desc" | "newest" | "popular" | "rating";
  page?: number;
  limit?: number;
}

// ─── Category ───
export interface Category {
  _id: string;
  parentId?: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  depth: number;
  path: string;
  children?: Category[];
}

// ─── Brand ───
export interface Brand {
  _id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  website?: string;
  description?: string;
  isActive: boolean;
}

// ─── Inventory ───
export interface Inventory {
  _id: string;
  variantSku: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  updatedAt: string;
}

export interface AdjustStockRequest {
  variantSku: string;
  quantity: number;
  notes?: string;
}

// ─── Order ───
export type OrderStatus =
  | "pending" | "confirmed" | "processing"
  | "shipped" | "delivered" | "cancelled" | "refunded";

export interface OrderItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: Record<string, any>;
  billingAddress: Record<string, any>;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  notes?: string;
  placedAt?: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment ───
export interface Payment {
  _id: string;
  orderId: string;
  method: string;
  provider: string;
  providerTxId: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  paidAt?: string;
}

// ─── Notification ───
export interface Notification {
  _id: string;
  userId: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
}

// ─── Dashboard Stats ───
export interface DashboardStats {
  overview: {
    totalOrders: number;
    todayOrders: number;
    monthRevenue: number;
    totalCustomers: number;
    totalProducts: number;
    lowStockCount: number;
    pendingOrders: number;
  };
  recentOrders: Pick<Order, "_id" | "orderNumber" | "status" | "total" | "createdAt">[];
}

// ─── Coupon ───
export interface Coupon {
  _id: string;
  code: string;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}
