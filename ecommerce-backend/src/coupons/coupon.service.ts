import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Coupon, CouponDocument } from './schemas/coupon.schema';
import { EventBusService } from '../shared/events/event-bus.service';
import { PaginatedResponseDto } from '../shared/database/pagination.dto';
import {
  CreateCouponDto, UpdateCouponDto, CouponQueryDto,
} from './dto/coupon.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    private eventBus: EventBusService,
  ) {}

  async create(dto: CreateCouponDto, actorId?: string): Promise<CouponDocument> {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.couponModel.findOne({ code });
    if (existing) throw new ConflictException('Coupon code already exists');

    if (dto.discountType === 'percentage' && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    const coupon = await this.couponModel.create({
      ...dto,
      code,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdBy: actorId ? new Types.ObjectId(actorId) : undefined,
    });

    await this.eventBus.emit('coupon.created', {
      couponId: coupon._id.toString(),
      code: coupon.code,
    });

    return coupon;
  }

  async findAll(query: CouponQueryDto): Promise<PaginatedResponseDto<CouponDocument>> {
    const filter: FilterQuery<Coupon> = {};
    if (query.code) filter.code = query.code.trim().toUpperCase();
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const sort: Record<string, 1 | -1> = {};
    if (query.sortBy) {
      sort[query.sortBy] = query.sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1;
    }

    const [data, total] = await Promise.all([
      this.couponModel.find(filter).sort(sort).skip(query.skip).limit(query.limit),
      this.couponModel.countDocuments(filter),
    ]);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<CouponDocument> {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<CouponDocument> {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (coupon.redemptionsCount > 0) {
      throw new ConflictException(
        'Coupon has already been redeemed and cannot be edited. Deactivate it instead.',
      );
    }

    if (dto.discountType === 'percentage' && dto.discountValue !== undefined && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    if (dto.code !== undefined) {
      const newCode = dto.code.trim().toUpperCase();
      if (newCode !== coupon.code) {
        const clash = await this.couponModel.findOne({ code: newCode, _id: { $ne: coupon._id } });
        if (clash) throw new ConflictException('Coupon code already exists');
      }
      (dto as any).code = newCode;
    }

    const patch: Record<string, unknown> = { ...dto };
    if (dto.startsAt !== undefined) patch.startsAt = new Date(dto.startsAt);
    if (dto.expiresAt !== undefined) patch.expiresAt = new Date(dto.expiresAt);

    const updated = await this.couponModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    if (!updated) throw new NotFoundException('Coupon not found');

    await this.eventBus.emit('coupon.updated', {
      couponId: id,
      changes: Object.keys(dto),
    });

    return updated;
  }

  async softDelete(id: string): Promise<{ success: true; id: string }> {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (coupon.redemptionsCount > 0) {
      throw new ConflictException(
        'Coupon has already been redeemed and cannot be deleted. Deactivate it instead.',
      );
    }

    await this.couponModel.updateOne(
      { _id: coupon._id },
      { $set: { isDeleted: true, deletedAt: new Date(), isActive: false } },
    );

    await this.eventBus.emit('coupon.deleted', { couponId: id });
    return { success: true, id };
  }

  async deactivate(id: string): Promise<CouponDocument> {
    const updated = await this.couponModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Coupon not found');

    await this.eventBus.emit('coupon.deactivated', { couponId: id });
    return updated;
  }

  /**
   * Customer-facing validation: check a code against a cart subtotal and return
   * the discount. Coupon monetary fields are stored in integer cents while cart
   * subtotals are in major currency units, so cents are converted (÷100) here.
   * Returns the discount in major units. Throws BadRequest with a clear reason.
   */
  async validateForCart(
    code: string,
    subtotal: number,
  ): Promise<{ coupon: CouponDocument; discount: number }> {
    const coupon = await this.couponModel.findOne({ code: code.trim().toUpperCase() });
    if (!coupon || !coupon.isActive) throw new BadRequestException('Invalid coupon code');

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('This coupon is not active yet');
    if (coupon.expiresAt && coupon.expiresAt < now) throw new BadRequestException('This coupon has expired');
    if (coupon.usageLimit !== undefined && coupon.redemptionsCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    const minPurchase = (coupon.minPurchaseAmount ?? 0) / 100;
    if (subtotal < minPurchase) {
      throw new BadRequestException(`A minimum purchase of ${minPurchase.toFixed(2)} is required`);
    }

    let discount: number;
    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount !== undefined) {
        discount = Math.min(discount, coupon.maxDiscountAmount / 100);
      }
    } else {
      discount = coupon.discountValue / 100;
    }
    discount = Math.min(Math.round(discount * 100) / 100, subtotal);

    return { coupon, discount };
  }
}
