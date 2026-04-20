import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InventoryDocument = HydratedDocument<Inventory>;

@Schema({ timestamps: true, collection: 'inventory' })
export class Inventory {
  @Prop({ required: true, index: true }) variantSku: string;
  @Prop({ type: Types.ObjectId, ref: 'Product', index: true }) productId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Warehouse' }) warehouseId: Types.ObjectId;
  @Prop({ type: Number, default: 0, min: 0 }) quantity: number;
  @Prop({ type: Number, default: 0, min: 0 }) reserved: number;
  @Prop({ type: Number, default: 10 }) reorderPoint: number;
}
export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ variantSku: 1, warehouseId: 1 }, { unique: true });

export type InventoryMovementDocument = HydratedDocument<InventoryMovement>;

@Schema({ timestamps: true, collection: 'inventory_movements' })
export class InventoryMovement {
  @Prop({ required: true }) variantSku: string;
  @Prop({ type: Types.ObjectId, ref: 'Warehouse' }) warehouseId: Types.ObjectId;
  @Prop({ enum: ['inbound', 'sold', 'returned', 'adjustment', 'reserved', 'released'], required: true })
  type: string;
  @Prop({ required: true }) quantity: number;
  @Prop() referenceType?: string;
  @Prop({ type: Types.ObjectId }) referenceId?: Types.ObjectId;
  @Prop() notes?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdBy?: Types.ObjectId;
}
export const InventoryMovementSchema = SchemaFactory.createForClass(InventoryMovement);

export type WarehouseDocument = HydratedDocument<Warehouse>;

@Schema({ timestamps: true, collection: 'warehouses' })
export class Warehouse {
  @Prop({ required: true }) name: string;
  @Prop({ unique: true }) code: string;
  @Prop() addressLine1: string;
  @Prop() city: string;
  @Prop() state: string;
  @Prop() postalCode: string;
  @Prop({ maxlength: 2 }) countryCode: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: 0 }) priority: number;
}
export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);
