import { Module } from '@nestjs/common';
import { MetaConversionsService } from './meta-conversions.service';
import { MetaMarketingService } from './meta-marketing.service';
import { MarketingController } from './marketing.controller';

// Server-side marketing integrations (Meta Conversions API, Marketing API, …).
// Kept standalone so any feature that produces a conversion can inject the
// services. The two Meta services use different tokens and do not share state.
@Module({
  controllers: [MarketingController],
  providers: [MetaConversionsService, MetaMarketingService],
  exports: [MetaConversionsService, MetaMarketingService],
})
export class MarketingModule {}
