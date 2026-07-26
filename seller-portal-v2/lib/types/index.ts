// Domain type definitions — shared between RTK Query, components, and pages.
// These mirror the shapes your NestJS backend returns.

// ────────────────────────────────────────────────────────────
// Products
// ────────────────────────────────────────────────────────────

export type ProductStatus = 'active' | 'draft' | 'archived';

export interface ProductOption {
  name: string;   // "Size"
  value: string;  // "M"
}

export interface ProductVariant {
  sku: string;
  name?: string;
  stockOnHand: number | string;
  priceOverride?: number | string;
  costPrice?: number | string;
  weightGrams?: number | string;
  barcode?: string;
  options: ProductOption[];
}

export interface ProductDimension {
  name: string;     // "Size"
  values: string[]; // ["S", "M", "L"]
}

export interface ProductImage {
  url: string;
  altText?: string;
  /** Variant-image association: image applies to variants whose options include
   *  every {name,value} here. Empty/absent = shared image (all variants). */
  appliesTo?: { name: string; value: string }[];
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface LocalizedFields {
  en?: { name?: string; shortDescription?: string; description?: string };
  tr?: { name?: string; shortDescription?: string; description?: string };
  so?: { name?: string; shortDescription?: string; description?: string };
  sw?: { name?: string; shortDescription?: string; description?: string };
  am?: { name?: string; shortDescription?: string; description?: string };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId?: string;
  brandId?: string;
  basePrice: number;
  compareAtPrice?: number | null;
  currency: string;
  status: ProductStatus;
  isFeatured?: boolean;
  stock: number | null;
  shortDescription?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  attributes: ProductAttribute[];
  images: ProductImage[];
  variants: ProductVariant[];
  localizations?: LocalizedFields;
  // Denormalized analytics — read-only/derived; never part of create/update payloads.
  // `totalSold` mirrors the backend Product field of the same name.
  totalSold: number;
  revenueLifetime: number;
  viewsLifetime: number;
  conversionRate?: number;
  returnRate?: number;
  // Timestamps
  updatedAt: string;
  createdAt: string;
  // Optional thumbnail initial used when no image is present
  initial?: string;
}

// What goes to POST /products — matches CreateProductDto
export interface CreateProductDto {
  name: string;
  basePrice: number;
  categoryId?: string;
  brandId?: string;
  shortDescription?: string;
  description?: string;
  compareAtPrice?: number;
  currency?: string;
  status?: ProductStatus;
  isFeatured?: boolean;
  variants?: Array<{
    sku: string;
    name?: string;
    priceOverride?: number;
    costPrice?: number;
    weightGrams?: number;
    barcode?: string;
    options?: ProductOption[];
  }>;
  images?: Array<{
    url: string;
    altText?: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
  attributes?: ProductAttribute[];
  metaTitle?: string;
  metaDescription?: string;
  localizations?: LocalizedFields;
}

// Inventory seed sent alongside a product create — never embedded in the product
// document (the backend tracks availability in its own collection). For variants,
// one entry per SKU; for single-SKU products, one entry with sku=null (the real
// SKU is assigned when the product is created).
export interface StockLevel {
  sku: string | null;
  onHand: number;
}
export type StockSeed = StockLevel[];

// Product form state — superset of CreateProductDto with UI-only flags (variant
// dimensions, single-SKU stock, the hasVariants toggle). Lives here so the DTO
// builders in lib/utils can be strongly typed.
export interface FormState {
  name: string;
  categoryId: string;
  brandId: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  compareAtPrice: string;
  currency: string;
  hasVariants: boolean;
  stockOnHand: string;
  dimensions: ProductDimension[];
  variants: ProductVariant[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  metaTitle: string;
  metaDescription: string;
  status: ProductStatus;
  isFeatured: boolean;
  localizations: LocalizedFields;
}

// ────────────────────────────────────────────────────────────
// Orders
// ────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'processing'
  | 'picked'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  initial: string;
  imageUrl?: string;
}

export interface OrderTimelineEvent {
  event: string;
  date: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  customer: string;
  customerEmail: string;
  customerPhone: string;
  destination: string;
  destinationFull: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  items: number;
  status: OrderStatus;
  date: string;
  placedAt: string;
  paymentMethod: string;
  carrier: string;
  trackingNumber: string;
  itemsList: OrderItem[];
  timeline: OrderTimelineEvent[];
}

// ────────────────────────────────────────────────────────────
// Inventory
// ────────────────────────────────────────────────────────────

export type InventoryMovementType = 'sale' | 'received' | 'manual' | 'returned' | 'damaged';

export interface InventoryMovement {
  type: InventoryMovementType;
  delta: number;
  reason: string;
  date: string;
}

export interface InventoryRow {
  sku: string;
  productName: string;
  productId: string;
  variantInfo: string;
  onHand: number;
  reserved: number;
  available: number;
  warehouse: string;
  reorderThreshold: number;
  movements: InventoryMovement[];
}

// ────────────────────────────────────────────────────────────
// Returns / RMA
// ────────────────────────────────────────────────────────────

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'received'
  | 'inspected'
  | 'refunded'
  | 'rejected';

export type ReturnReason =
  | 'wrong-size'
  | 'wrong-item'
  | 'damaged'
  | 'not-as-described'
  | 'changed-mind'
  | 'other';

export type RefundDecision = 'full-refund' | 'partial-refund' | 'replace' | 'reject';

export interface ReturnItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  initial: string;
  restockable: boolean;
}

export interface Return {
  id: string;          // RMA-12345
  orderId: string;
  customer: string;
  customerEmail: string;
  reason: ReturnReason;
  reasonNote?: string;
  status: ReturnStatus;
  decision?: RefundDecision;
  requestedAt: string;
  receivedAt?: string;
  refundedAt?: string;
  items: ReturnItem[];
  refundAmount: number;
  restockingFee?: number;
}

// ────────────────────────────────────────────────────────────
// Messages
// ────────────────────────────────────────────────────────────

export type MessageStatus = 'unread' | 'read' | 'replied';

export interface Message {
  id: string;
  from: 'customer' | 'seller';
  body: string;
  sentAt: string;
}

export interface MessageThread {
  id: string;
  customer: string;
  customerEmail: string;
  orderId?: string;
  subject: string;
  preview: string;
  status: MessageStatus;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
}

// ────────────────────────────────────────────────────────────
// Dashboard / Analytics
// ────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  grossSales: number;
  netRevenue: number;
  profit: number;
  ordersToday: number;
  ordersThisWeek: number;
  pendingFulfillment: number;
  lowStockSkus: number;
  unrepliedMessages: number;
  pendingReturns: number;
  // Trend
  weekRevenue: number[];
  weekProfit: number[];
  weekLabels: string[];
  // Cost breakdown for profit truth
  costs: {
    productCost: number;
    platformFee: number;
    paymentFee: number;
    shippingCost: number;
    refundCost: number;
  };
  // Store health
  health: {
    rating: number;          // 0–5
    onTimeShipmentPct: number;
    cancellationRatePct: number;
    returnRatePct: number;
    responseRatePct: number;
  };
  // Action board
  actionBoard: {
    fix: ActionItem[];
    watch: ActionItem[];
    scale: ActionItem[];
  };
}

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  impact?: 'high' | 'med' | 'low';
}

export interface ProductLeaderboardEntry {
  productId: string;
  name: string;
  initial: string;
  imageUrl?: string;
  revenue: number;
  units: number;
  changePct: number;
}

// ────────────────────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  category: 'order' | 'stock' | 'message' | 'payout' | 'system';
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────
// Other
// ────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  country: string;
  orders: number;
  lifetime: number;
  lastOrder: string;
}

export interface ShippingZone {
  destination: string;
  leadTime: string;
  baseRate: number;
  status: 'live' | 'limited' | 'paused';
}

export interface Promotion {
  code: string;
  discount: string;
  used: number;
  limit: number | null;
  expires: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  fee: number;
  date: string;
}
