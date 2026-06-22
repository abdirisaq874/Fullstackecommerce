import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { ShippingZone, ShippingZoneDocument } from './schemas/shipping-zone.schema';
import { ShippingRate, ShippingRateDocument } from './schemas/shipping-rate.schema';
import {
  CreateZoneDto, UpdateZoneDto,
  CreateRateDto, UpdateRateDto,
  QuoteDto,
} from './dto/shipping.dto';

export interface QuoteRateResult {
  method: string;
  costCents: number;
  minDays?: number;
  maxDays?: number;
}

export interface QuoteResult {
  rates: QuoteRateResult[];
}

@Injectable()
export class ShippingService {
  constructor(
    @InjectModel(ShippingZone.name) private zoneModel: Model<ShippingZone>,
    @InjectModel(ShippingRate.name) private rateModel: Model<ShippingRate>,
  ) {}

  // ═══════════════════════════════════════════
  // ZONES
  // ═══════════════════════════════════════════

  async listZones(sellerId: string, role?: string): Promise<ShippingZoneDocument[]> {
    const filter: FilterQuery<ShippingZone> = role === 'admin'
      ? {}
      : { sellerId: new Types.ObjectId(sellerId) };
    return this.zoneModel.find(filter).sort({ createdAt: -1 });
  }

  async createZone(dto: CreateZoneDto, sellerId: string): Promise<ShippingZoneDocument> {
    return this.zoneModel.create({
      ...dto,
      sellerId: new Types.ObjectId(sellerId),
    });
  }

  async updateZone(
    id: string,
    dto: UpdateZoneDto,
    sellerId: string,
    role?: string,
  ): Promise<ShippingZoneDocument> {
    const filter = this.scopedZoneFilter(id, sellerId, role);
    const zone = await this.zoneModel.findOneAndUpdate(
      filter,
      { $set: dto },
      { new: true },
    );
    if (!zone) throw new NotFoundException('Shipping zone not found');
    return zone;
  }

  async deleteZone(
    id: string,
    sellerId: string,
    role?: string,
  ): Promise<{ success: boolean }> {
    const filter = this.scopedZoneFilter(id, sellerId, role);
    const zone = await this.zoneModel.findOneAndUpdate(
      filter,
      { $set: { isDeleted: true, deletedAt: new Date(), active: false } },
      { new: true },
    );
    if (!zone) throw new NotFoundException('Shipping zone not found');

    // Soft-delete cascade to dependent rates
    await this.rateModel.updateMany(
      { zoneId: zone._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), active: false } },
    );

    return { success: true };
  }

  // ═══════════════════════════════════════════
  // RATES
  // ═══════════════════════════════════════════

  async listRates(
    zoneId: string,
    sellerId: string,
    role?: string,
  ): Promise<ShippingRateDocument[]> {
    await this.assertZoneAccess(zoneId, sellerId, role);
    return this.rateModel.find({ zoneId: new Types.ObjectId(zoneId) }).sort({ method: 1 });
  }

  async createRate(
    zoneId: string,
    dto: CreateRateDto,
    sellerId: string,
    role?: string,
  ): Promise<ShippingRateDocument> {
    await this.assertZoneAccess(zoneId, sellerId, role);
    return this.rateModel.create({
      ...dto,
      zoneId: new Types.ObjectId(zoneId),
    });
  }

  async updateRate(
    zoneId: string,
    rateId: string,
    dto: UpdateRateDto,
    sellerId: string,
    role?: string,
  ): Promise<ShippingRateDocument> {
    await this.assertZoneAccess(zoneId, sellerId, role);
    const rate = await this.rateModel.findOneAndUpdate(
      { _id: new Types.ObjectId(rateId), zoneId: new Types.ObjectId(zoneId) },
      { $set: dto },
      { new: true },
    );
    if (!rate) throw new NotFoundException('Shipping rate not found');
    return rate;
  }

  async deleteRate(
    zoneId: string,
    rateId: string,
    sellerId: string,
    role?: string,
  ): Promise<{ success: boolean }> {
    await this.assertZoneAccess(zoneId, sellerId, role);
    const rate = await this.rateModel.findOneAndUpdate(
      { _id: new Types.ObjectId(rateId), zoneId: new Types.ObjectId(zoneId) },
      { $set: { isDeleted: true, deletedAt: new Date(), active: false } },
      { new: true },
    );
    if (!rate) throw new NotFoundException('Shipping rate not found');
    return { success: true };
  }

  // ═══════════════════════════════════════════
  // QUOTE (Public)
  // ═══════════════════════════════════════════

  async quote(dto: QuoteDto): Promise<QuoteResult> {
    const country = dto.destinationCountry.toUpperCase();
    const totalQty = dto.items.reduce((sum, item) => sum + item.qty, 0);

    // TODO: integrate carrier APIs (UPS/FedEx/USPS) for live rate quotes.
    // For now, this is a stub that aggregates rates from matching zones.
    const zones = await this.zoneModel.find({
      countries: country,
      active: true,
    });

    if (zones.length === 0) {
      return { rates: [] };
    }

    const zoneIds = zones.map((z) => z._id);
    const rates = await this.rateModel.find({
      zoneId: { $in: zoneIds },
      active: true,
    });

    const computed: QuoteRateResult[] = rates.map((rate) => ({
      method: rate.method,
      costCents: rate.baseCostCents + (rate.perItemCostCents ?? 0) * totalQty,
      minDays: rate.minDeliveryDays,
      maxDays: rate.maxDeliveryDays,
    }));

    return { rates: computed };
  }

  // ═══════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════

  private scopedZoneFilter(
    id: string,
    sellerId: string,
    role?: string,
  ): FilterQuery<ShippingZone> {
    return {
      _id: new Types.ObjectId(id),
      ...(role === 'admin' ? {} : { sellerId: new Types.ObjectId(sellerId) }),
    };
  }

  private async assertZoneAccess(
    zoneId: string,
    sellerId: string,
    role?: string,
  ): Promise<void> {
    const zone = await this.zoneModel.findById(zoneId);
    if (!zone) throw new NotFoundException('Shipping zone not found');
    if (role !== 'admin' && zone.sellerId.toString() !== sellerId) {
      throw new ForbiddenException('You do not own this shipping zone');
    }
  }
}
