import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: true })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product' }) productId: Types.ObjectId;
  @Prop() variantSku: string;
  @Prop() productName: string;
  @Prop() variantName: string;
  @Prop() sku: string;
  // Product slug — the catalog id used by external ad feeds (Meta/Google), so a
  // Purchase pixel/CAPI event can reference the same content_id as the feed.
  @Prop() slug?: string;
  @Prop() imageUrl: string;
  @Prop({ required: true }) quantity: number;
  @Prop({ required: true }) unitPrice: number;
  @Prop({ required: true }) totalPrice: number;
  // Seller snapshot — lets orders be grouped/split by store without a join.
  @Prop({ type: Types.ObjectId, ref: 'User' }) sellerId?: Types.ObjectId;
  @Prop() storeName?: string;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ unique: true, index: true }) orderNumber: string;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) userId: Types.ObjectId;
  // The store this order belongs to. A multi-store cart is split into one order
  // per store at checkout, so every new order has exactly one storeId.
  @Prop({ type: Types.ObjectId, ref: 'Store', index: true }) storeId?: Types.ObjectId;
  @Prop() storeName?: string;

  @Prop({
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending', index: true,
  })
  status: string;

  @Prop({ type: [OrderItemSchema], default: [] }) items: OrderItem[];
  @Prop({ type: Object }) shippingAddress: Record<string, any>;
  @Prop({ type: Object }) billingAddress: Record<string, any>;

  @Prop({ type: Number }) subtotal: number;
  @Prop({ type: Number, default: 0 }) shippingCost: number;
  @Prop({ type: Number, default: 0 }) taxAmount: number;
  @Prop({ type: Number, default: 0 }) discountAmount: number;
  @Prop({ type: Number }) total: number;
  @Prop({ default: 'USD' }) currency: string;

  // How the buyer pays. Only 'cod' (cash/pay-on-delivery) is live; card (Stripe),
  // mpesa (Kenya) and waafi (Somalia) are planned. `paymentStatus` tracks
  // settlement — COD stays 'pending' until collected on delivery.
  @Prop({ enum: ['card', 'mpesa', 'waafi', 'cod'], default: 'cod' }) paymentMethod: string;
  @Prop({ enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' }) paymentStatus: string;

  @Prop({ type: Types.ObjectId }) couponId?: Types.ObjectId;
  @Prop() notes?: string;
  @Prop() stripePaymentIntentId?: string;

  @Prop() placedAt?: Date;
  @Prop() confirmedAt?: Date;
  @Prop() shippedAt?: Date;
  @Prop() deliveredAt?: Date;
  @Prop() cancelledAt?: Date;
}
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ storeId: 1, createdAt: -1 });

@Schema({ timestamps: true, collection: 'order_status_history' })
export class OrderStatusHistory {
  @Prop({ type: Types.ObjectId, ref: 'Order', index: true }) orderId: Types.ObjectId;
  @Prop() fromStatus: string;
  @Prop() toStatus: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) changedBy?: Types.ObjectId;
  @Prop() reason?: string;
}
export const OrderStatusHistorySchema = SchemaFactory.createForClass(OrderStatusHistory);
