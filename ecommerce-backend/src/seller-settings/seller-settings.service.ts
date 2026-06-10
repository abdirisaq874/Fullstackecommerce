import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SellerSettings,
  SellerSettingsDocument,
} from './schemas/seller-settings.schema';
import { UpdateSellerSettingsDto } from './dto/seller-settings.dto';

@Injectable()
export class SellerSettingsService {
  constructor(
    @InjectModel(SellerSettings.name)
    private readonly sellerSettingsModel: Model<SellerSettings>,
  ) {}

  /**
   * Returns the seller's settings document, creating one with defaults
   * on first read. One document per seller (keyed by userId).
   */
  async findOrCreateForUser(userId: string): Promise<SellerSettingsDocument> {
    const sellerObjectId = new Types.ObjectId(userId);

    const existing = await this.sellerSettingsModel.findOne({
      sellerId: sellerObjectId,
    });
    if (existing) return existing;

    // Create-on-first-read: schema defaults populate embedded subdocs.
    return this.sellerSettingsModel.create({ sellerId: sellerObjectId });
  }

  /**
   * Full update via $set. Upserts so callers can PUT before ever reading.
   */
  async update(
    userId: string,
    dto: UpdateSellerSettingsDto,
  ): Promise<SellerSettingsDocument> {
    const sellerObjectId = new Types.ObjectId(userId);

    const $set: Record<string, unknown> = {};

    if (dto.storeProfile !== undefined) $set.storeProfile = dto.storeProfile;
    if (dto.payouts !== undefined) $set.payouts = dto.payouts;
    if (dto.tax !== undefined) $set.tax = dto.tax;
    if (dto.notifications !== undefined) $set.notifications = dto.notifications;
    if (dto.shippingDefaults !== undefined) {
      $set.shippingDefaults = {
        ...dto.shippingDefaults,
        defaultZoneId: dto.shippingDefaults.defaultZoneId
          ? new Types.ObjectId(dto.shippingDefaults.defaultZoneId)
          : undefined,
      };
    }
    if (dto.preferredLanguage !== undefined) {
      $set.preferredLanguage = dto.preferredLanguage;
    }

    const updated = await this.sellerSettingsModel.findOneAndUpdate(
      { sellerId: sellerObjectId },
      {
        $set,
        $setOnInsert: { sellerId: sellerObjectId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return updated as SellerSettingsDocument;
  }
}
