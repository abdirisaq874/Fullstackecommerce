import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Store } from '../stores/schemas/store.schema';
import { EmailBrand } from './templates/components/EmailLayout';

export interface ResolvedBrand extends EmailBrand {
  locale?: string;
  ownerId?: string;
  newOrderEmail?: boolean;
}

/** Resolves the From/branding for an email: the store's identity, or platform defaults. */
@Injectable()
export class StoreBrandingService {
  private readonly platformName: string;
  private readonly platformLogo?: string;
  private readonly platformSupport?: string;

  constructor(
    @InjectModel(Store.name) private readonly storeModel: Model<Store>,
    config: ConfigService,
  ) {
    this.platformName = config.get<string>('PLATFORM_NAME') || 'Gaarsii';
    this.platformLogo = config.get<string>('PLATFORM_LOGO_URL') || undefined;
    this.platformSupport =
      config.get<string>('MAIL_REPLY_TO') || config.get<string>('PLATFORM_SUPPORT_EMAIL') || undefined;
  }

  platform(): ResolvedBrand {
    return {
      name: this.platformName,
      logoUrl: this.platformLogo,
      supportEmail: this.platformSupport,
      brandColor: '#1a2744',
    };
  }

  async forStore(storeId?: string): Promise<ResolvedBrand> {
    if (!storeId) return this.platform();
    const s = await this.storeModel.findById(storeId).lean();
    if (!s) return this.platform();
    const store = s as unknown as {
      displayName?: string;
      logoUrl?: string;
      supportEmail?: string;
      preferredLanguage?: string;
      ownerId?: { toString(): string };
      notifications?: { newOrderEmail?: boolean };
    };
    return {
      name: store.displayName || this.platformName,
      logoUrl: store.logoUrl || this.platformLogo,
      supportEmail: store.supportEmail || this.platformSupport,
      brandColor: '#1a2744',
      locale: store.preferredLanguage || 'en',
      ownerId: store.ownerId?.toString(),
      newOrderEmail: store.notifications?.newOrderEmail !== false,
    };
  }
}
