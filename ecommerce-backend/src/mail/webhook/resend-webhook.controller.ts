import { Body, Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { EmailLog, EmailLogDocument } from '../schemas/email-log.schema';

/**
 * Resend delivery webhook (Svix-signed). Updates the EmailLog status on
 * delivered/bounced/complained/sent. Mounted only in the API process (via
 * MailModule.forApi) and excluded from the global api/v1 prefix + needs
 * rawBody:true (both configured in main.ts).
 */
@Controller('webhooks/resend')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(
    @InjectModel(EmailLog.name) private readonly logs: Model<EmailLogDocument>,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: { rawBody?: Buffer },
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ): Promise<{ ok: boolean }> {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (secret) {
      const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}), 'utf8');
      if (!this.verify(secret, headers, raw)) {
        this.logger.warn('resend webhook signature verification failed');
        return { ok: false };
      }
    }

    const emailId = body?.data?.email_id;
    if (!emailId) return { ok: true };
    const log = await this.logs.findOne({ providerMessageId: emailId });
    if (!log) return { ok: true }; // unknown id — ack so Resend stops retrying

    const at = body?.created_at ? new Date(body.created_at) : new Date();
    switch (body.type) {
      case 'email.delivered':
        log.status = 'delivered';
        log.deliveredAt = at;
        break;
      case 'email.bounced':
        log.status = 'bounced';
        log.failedAt = at;
        log.failureKind = 'bounce';
        log.failureReason = body?.data?.bounce?.message || 'Email bounced';
        break;
      case 'email.complained':
        log.status = 'complained';
        log.failedAt = at;
        log.failureKind = 'complaint';
        log.failureReason = 'Recipient marked as spam';
        break;
      case 'email.sent':
        if (log.status === 'queued') {
          log.status = 'sent';
          log.sentAt = at;
        }
        break;
      default:
        return { ok: true };
    }
    await log.save();
    return { ok: true };
  }

  private verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean {
    try {
      const id = headers['svix-id'];
      const ts = headers['svix-timestamp'];
      const sig = headers['svix-signature'];
      if (!id || !ts || !sig) return false;
      // Reject stale timestamps (>5 min).
      if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
      const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
      const signed = `${id}.${ts}.${rawBody.toString('utf8')}`;
      const expected = createHmac('sha256', key).update(signed).digest('base64');
      const expectedBuf = Buffer.from(expected);
      return sig.split(' ').some((part) => {
        const s = part.includes(',') ? part.split(',')[1] : part;
        const got = Buffer.from(s);
        return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
      });
    } catch {
      return false;
    }
  }
}
