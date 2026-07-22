import { Module } from '@nestjs/common';
import { MetaConversionsService } from './meta-conversions.service';

// Server-side marketing integrations (Meta Conversions API, …). Kept standalone
// so any feature that produces a conversion can inject the service.
@Module({
  providers: [MetaConversionsService],
  exports: [MetaConversionsService],
})
export class MarketingModule {}
