import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { ShippingZone, ShippingZoneSchema } from './schemas/shipping-zone.schema';
import { ShippingRate, ShippingRateSchema } from './schemas/shipping-rate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShippingZone.name, schema: ShippingZoneSchema },
      { name: ShippingRate.name, schema: ShippingRateSchema },
    ]),
  ],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
