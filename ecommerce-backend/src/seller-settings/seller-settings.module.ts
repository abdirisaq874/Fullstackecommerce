import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SellerSettingsController } from './seller-settings.controller';
import { SellerSettingsService } from './seller-settings.service';
import {
  SellerSettings,
  SellerSettingsSchema,
} from './schemas/seller-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SellerSettings.name, schema: SellerSettingsSchema },
    ]),
  ],
  controllers: [SellerSettingsController],
  providers: [SellerSettingsService],
  exports: [SellerSettingsService],
})
export class SellerSettingsModule {}
