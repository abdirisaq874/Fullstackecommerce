import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RecommendationsService } from '../recommendations.service';

/**
 * Turns a completed order into the strongest behavioural signal we have — a
 * `purchase` interaction per item — so "For you" learns what a customer actually buys.
 */
@Injectable()
export class RecommendationsListener {
  private readonly logger = new Logger(RecommendationsListener.name);

  constructor(private readonly svc: RecommendationsService) {}

  @OnEvent('order.placed')
  async onOrderPlaced(payload: { userId?: string; items?: { productId?: string }[] }): Promise<void> {
    if (!payload?.userId) return;
    for (const it of payload.items || []) {
      if (it?.productId) await this.svc.recordInteraction(payload.userId, String(it.productId), 'purchase');
    }
  }
}
