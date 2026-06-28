// ─── Shared domain types (mirror the NestJS backend responses) ───

export interface Paginated<T> {
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  role: 'customer' | 'seller' | 'admin' | string;
  emailVerified?: boolean;
}

export interface Address {
  _id?: string;
  type?: 'shipping' | 'billing';
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  isDefault?: boolean;
}

export interface ProductVariantOption {
  name: string;
  value: string;
}
export interface ProductVariant {
  _id: string;
  sku: string;
  name?: string;
  priceOverride?: number;
  barcode?: string;
  isActive?: boolean;
  options: ProductVariantOption[];
}
export interface ProductImage {
  _id: string;
  url: string;
  altText?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}
export interface ProductAttribute {
  key: string;
  value: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  currency: string;
  status?: string;
  isFeatured?: boolean;
  avgRating?: number;
  reviewCount?: number;
  totalSold?: number;
  categoryId?: string | Category;
  brandId?: string | Brand;
  variants?: ProductVariant[];
  images?: ProductImage[];
  attributes?: ProductAttribute[];
  localizations?: Record<string, { name?: string; shortDescription?: string; description?: string }>;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder?: number;
  children?: Category[];
  localizations?: Record<string, { name?: string }>;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
}

// ─── Smart search ───
export interface SmartSearchResult {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  price: number;
  currency: string;
  avgRating: number;
  totalSold: number;
  isFeatured: boolean;
  categoryId?: string;
  brandId?: string;
  imageUrl?: string;
}
export interface FacetOption {
  value: string;
  count: number;
}
export interface Facet {
  key: string;
  type: 'terms' | 'range' | 'color';
  label: string;
  options?: FacetOption[];
  min?: number;
  max?: number;
  unit?: string;
}
export interface SmartSearchResponse {
  data: SmartSearchResult[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  facets: Facet[];
  query: { raw?: string; appliedFilters: Record<string, unknown> };
}

// ─── Cart ───
export interface CartItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantName?: string;
  imageUrl?: string;
  slug?: string;
  quantity: number;
  unitPrice: number;
}
export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  couponCode?: string;
  discountAmount?: number;
}

// ─── Orders ───
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  productId: string;
  variantSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}
export interface Order {
  _id: string;
  orderNumber: string;
  userId?: string;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address;
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
  createdAt?: string;
}

// ─── Shipping ───
export interface ShippingRate {
  method: string;
  costCents: number;
  minDays: number;
  maxDays: number;
}

// ─── Returns ───
export interface ReturnItem {
  sku: string;
  qty: number;
  reason: string;
}
export interface ReturnRequest {
  _id: string;
  orderId: string;
  status: string;
  items: ReturnItem[];
  createdAt?: string;
}

// ─── Reviews (backend addition) ───
export interface Review {
  _id: string;
  productId: string;
  userId: string;
  authorName?: string;
  rating: number;
  title?: string;
  body?: string;
  createdAt?: string;
}

// ─── Messages ───
export interface MessageThread {
  _id: string;
  sellerId: string;
  customerId: string;
  subject: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCountCustomer?: number;
  relatedOrderId?: string;
  status: 'open' | 'closed';
}
export interface Message {
  _id: string;
  threadId: string;
  authorId: string;
  authorRole: string;
  body: string;
  attachments?: { url: string; name: string }[];
  createdAt?: string;
}

// ─── Wishlist (client-side + backend addition) ───
export interface WishlistEntry {
  productId: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}
