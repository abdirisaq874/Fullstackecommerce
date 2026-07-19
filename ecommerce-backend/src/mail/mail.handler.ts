import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { QUEUE_NAMES } from '../shared/queues/queue.constants';
import { EventJobData } from '../shared/events/domain-event';
import { EmailEventType } from '../shared/events/email-event.enum';
import { MailService } from './mail.service';
import { StoreBrandingService, ResolvedBrand } from './store-branding.service';
import { EVENT_TEMPLATE_MAP, RecipientKind } from './mail-event.map';
import { PermanentEmailError } from './providers/email-provider.interface';
import { User } from '../users/schemas/user.schema';

/**
 * The single consumer that turns outbox domain events into emails. Runs in the
 * WORKERS process only. Resolves recipient + store branding, then delegates to
 * MailService (which handles idempotency + logging). Permanent failures are
 * dropped; transient ones re-throw so BullMQ retries per DEFAULT_JOB_OPTIONS.
 */
@Injectable()
@Processor(QUEUE_NAMES.MAIL, { concurrency: 10 })
export class MailHandler extends WorkerHost {
  private readonly logger = new Logger(MailHandler.name);
  private readonly shopUrl: string;
  private readonly sellerUrl: string;

  constructor(
    private readonly mail: MailService,
    private readonly branding: StoreBrandingService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    config: ConfigService,
  ) {
    super();
    const urls = (config.get<string>('FRONTEND_URL') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.shopUrl = urls[0] || 'https://shop.gaarsiiglobal.com';
    this.sellerUrl = urls[1] || 'https://seller.gaarsiiglobal.com';
  }

  /** Build the CTA URL(s) for an event from config + payload ids/tokens. */
  private buildUrls(eventType: string, p: Record<string, any>): Record<string, string> {
    const shop = this.shopUrl;
    const seller = this.sellerUrl;
    const orderUrl = p.orderId ? `${shop}/orders/${p.orderId}` : `${shop}/orders`;
    switch (eventType) {
      case EmailEventType.ORDER_PLACED:
        return { ordersUrl: `${shop}/orders` };
      case EmailEventType.ORDER_CONFIRMED:
      case EmailEventType.ORDER_SHIPPED:
      case EmailEventType.ORDER_DELIVERED:
      case EmailEventType.ORDER_CANCELLED:
        return { orderUrl };
      case EmailEventType.STORE_ORDER_RECEIVED:
        return { dashboardUrl: p.orderId ? `${seller}/orders/${p.orderId}` : `${seller}/orders` };
      case EmailEventType.RETURN_REQUESTED:
      case EmailEventType.REFUND_ISSUED:
        return { returnUrl: orderUrl, refundUrl: orderUrl };
      case EmailEventType.PAYOUT_PAID:
        return { financeUrl: `${seller}/finance` };
      case EmailEventType.AUTH_EMAIL_VERIFY:
        return { verifyUrl: `${shop}/verify-email?token=${p.token || ''}` };
      case EmailEventType.AUTH_PASSWORD_RESET:
        return { resetUrl: `${shop}/reset-password?token=${p.token || ''}` };
      case EmailEventType.STORE_STAFF_INVITED:
        return { acceptUrl: `${seller}/accept-invite?token=${p.token || ''}` };
      default:
        return {};
    }
  }

  async process(job: Job<EventJobData>): Promise<void> {
    const { eventType, aggregateId, payload, idempotencyKey, correlationId } = job.data;
    const spec = EVENT_TEMPLATE_MAP[eventType];
    if (!spec) return;

    const p: Record<string, any> = payload || {};
    const brand =
      spec.brandKind === 'store' ? await this.branding.forStore(p.storeId) : this.branding.platform();

    // Honor the store's per-store "new order email" preference.
    if (eventType === EmailEventType.STORE_ORDER_RECEIVED && brand.newOrderEmail === false) return;

    const to = await this.resolveRecipient(spec.recipient, p, brand);
    if (!to) {
      this.logger.warn(`no recipient resolved for ${eventType} (${aggregateId})`);
      return;
    }

    try {
      await this.mail.send({
        to,
        template: spec.template,
        subject: spec.subject(p),
        data: { ...p, brand, ...this.buildUrls(eventType, p) },
        locale: p.locale || brand.locale || 'en',
        recipientUserId: p.recipientUserId,
        senderDisplayName: brand.name,
        replyTo: brand.supportEmail,
        meta: {
          triggeredByEventType: eventType,
          triggeredByAggregateId: aggregateId,
          idempotencyKey,
          correlationId,
        },
      });
    } catch (err) {
      if (err instanceof PermanentEmailError) {
        this.logger.warn(`permanent mail failure (${eventType}): ${err.message}`);
        return; // drop — no retry
      }
      throw err; // transient → BullMQ retries
    }
  }

  private async resolveRecipient(
    kind: RecipientKind,
    p: Record<string, any>,
    brand: ResolvedBrand,
  ): Promise<string | undefined> {
    if (p.recipientEmail) return p.recipientEmail;
    if (kind === 'storeOwner' && brand.ownerId) {
      const u = await this.userModel.findById(brand.ownerId).select('email').lean();
      return (u as { email?: string } | null)?.email;
    }
    if (p.recipientUserId) {
      const u = await this.userModel.findById(p.recipientUserId).select('email').lean();
      return (u as { email?: string } | null)?.email;
    }
    return undefined;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(
      `mail job "${job?.name}" failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err?.message}`,
    );
  }
}
