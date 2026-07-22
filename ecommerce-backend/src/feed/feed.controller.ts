import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { FeedService } from './feed.service';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * Meta Commerce (and Google Merchant) pull this URL on a schedule to keep the
   * product catalog in sync. We inject @Res() so the handler runs in library
   * mode — this bypasses the global TransformInterceptor (which would otherwise
   * wrap the body in the {success,data,timestamp} JSON envelope) and lets us
   * emit raw XML. @SkipThrottle keeps the scheduled crawler off the rate limit.
   */
  @Get('facebook.xml')
  @SkipThrottle()
  @ApiOperation({ summary: 'Meta/Google product catalog feed (RSS 2.0 XML)' })
  async facebook(@Res() res: Response): Promise<void> {
    const xml = await this.feedService.generateFacebookFeed();
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      // Meta pulls at most hourly; a short cache absorbs any extra hits.
      'Cache-Control': 'public, max-age=1800',
    });
    res.send(xml);
  }
}
