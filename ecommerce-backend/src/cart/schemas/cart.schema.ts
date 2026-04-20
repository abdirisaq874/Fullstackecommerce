// ─── cart/schemas/cart.schema.ts ───
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

@Schema({ _id: true })
export class CartItem {
  _id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true }) productId: Types.ObjectId;
  @Prop({ required: true }) variantSku: string;
  @Prop() productName: string;
  @Prop() variantName: string;
  @Prop() imageUrl: string;
  @Prop({ required: true, min: 1 }) quantity: number;
  @Prop({ required: true }) unitPrice: number;
  @Prop({ default: Date.now }) addedAt: Date;
}
export const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', unique: true, sparse: true })
  userId?: Types.ObjectId;

  @Prop() sessionId?: string;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop() couponCode?: string;
}
export const CartSchema = SchemaFactory.createForClass(Cart);
CartSchema.index({ sessionId: 1 }, { sparse: true });

export default { Cart, CartSchema };
