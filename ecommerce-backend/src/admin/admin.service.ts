import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import { User } from '../users/schemas/user.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Inventory.name) private inventoryModel: Model<Inventory>,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders,
      todayOrders,
      monthRevenue,
      totalCustomers,
      totalProducts,
      lowStockCount,
      pendingOrders,
      recentOrders,
    ] = await Promise.all([
      this.orderModel.countDocuments(),
      this.orderModel.countDocuments({ createdAt: { $gte: todayStart } }),
      this.orderModel.aggregate([
        { $match: { status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      this.userModel.countDocuments({ role: 'customer' }),
      this.productModel.countDocuments({ status: 'active' }),
      this.inventoryModel.countDocuments({
        $expr: { $lte: ['$quantity', '$reorderPoint'] },
      }),
      this.orderModel.countDocuments({ status: 'pending' }),
      this.orderModel
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber status total createdAt'),
    ]);

    return {
      overview: {
        totalOrders,
        todayOrders,
        monthRevenue: monthRevenue[0]?.total || 0,
        totalCustomers,
        totalProducts,
        lowStockCount,
        pendingOrders,
      },
      recentOrders,
    };
  }

  async getRevenueChart(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return data.map((d) => ({
      date: d._id,
      revenue: d.revenue,
      orders: d.orderCount,
    }));
  }

  async getOrdersByStatus() {
    return this.orderModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }
}
