import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { StoreContextGuard } from './guards/store-context.guard';
import { Store, StoreSchema } from './schemas/store.schema';
import { StoreMembership, StoreMembershipSchema } from './schemas/store-membership.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Store.name, schema: StoreSchema },
      { name: StoreMembership.name, schema: StoreMembershipSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [StoresController],
  providers: [StoresService, StoreContextGuard],
  // Exported so Phase-2 modules (products, orders, …) can scope by active store.
  exports: [StoresService, StoreContextGuard, MongooseModule],
})
export class StoresModule {}
