import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetaMarketingService } from './meta-marketing.service';
import { Auth } from '../auth/guards/auth.guards';

// Admin-only: there is one platform ad account, not one per seller. Per-seller
// ad reporting needs sellers to connect their own Meta accounts, which requires
// App Review — until then, exposing this to sellers would show every seller the
// same platform-wide numbers.
@ApiTags('marketing')
@Controller('marketing/ads')
export class MarketingController {
  constructor(private readonly meta: MetaMarketingService) {}

  @Get('summary')
  @Auth('admin')
  @ApiOperation({ summary: 'Ad account health + performance for the period' })
  async getSummary(@Query('period') period?: string) {
    if (!this.meta.enabled) {
      return { configured: false, reason: 'META_MARKETING_TOKEN is not set' };
    }
    const datePreset = period || 'last_30d';
    const [account, insights] = await Promise.all([
      this.meta.getAccountSummary(),
      this.meta.getInsights(datePreset),
    ]);
    return { configured: true, account, insights };
  }

  @Get('campaigns')
  @Auth('admin')
  @ApiOperation({ summary: 'Campaigns with spend and conversions for the period' })
  async getCampaigns(@Query('period') period?: string) {
    if (!this.meta.enabled) {
      return { configured: false, campaigns: [] };
    }
    return { configured: true, campaigns: await this.meta.getCampaigns(period || 'last_30d') };
  }
}
