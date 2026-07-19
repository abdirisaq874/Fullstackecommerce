import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailLog, EmailLogDocument } from './schemas/email-log.schema';
import { MailRendererService } from './mail-renderer.service';
import {
  EmailProviderAdapter,
  EmailAttachment,
  PermanentEmailError,
} from './providers/email-provider.interface';

export interface SendOptions {
  to: string;
  template: string;
  subject: string;
  data: Record<string, unknown>;
  locale?: string;
  recipientUserId?: string;
  /** White-label: overrides the From display name (store name). Address stays platform. */
  senderDisplayName?: string;
  /** Overrides the default Reply-To (store support email). */
  replyTo?: string;
  attachments?: EmailAttachment[];
  meta?: {
    triggeredByEventType?: string;
    triggeredByAggregateId?: string;
    idempotencyKey?: string;
    correlationId?: string;
  };
}

export interface SendOutcome {
  emailLogId: string;
  providerMessageId: string;
  skipped: boolean;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly defaultFrom: string;
  private readonly defaultFromAddress: string;
  private readonly defaultReplyTo?: string;

  constructor(
    @InjectModel(EmailLog.name) private readonly logs: Model<EmailLogDocument>,
    private readonly renderer: MailRendererService,
    private readonly provider: EmailProviderAdapter,
    config: ConfigService,
  ) {
    this.defaultFrom = config.get<string>('MAIL_FROM') || 'Gaarsii <no-reply@gaarsiiglobal.com>';
    const m = this.defaultFrom.match(/<([^>]+)>/);
    this.defaultFromAddress = m ? m[1] : this.defaultFrom;
    this.defaultReplyTo = config.get<string>('MAIL_REPLY_TO') || undefined;
  }

  async send(options: SendOptions): Promise<SendOutcome> {
    const meta = options.meta ?? {};

    // 1. Idempotency: skip if an active send for this trigger+template exists.
    //    (Concurrency is already prevented by the outbox unique index + BullMQ
    //    jobId, so this is a clean, race-free final check; failed/bounced are
    //    intentionally re-sendable.)
    if (meta.triggeredByEventType && meta.triggeredByAggregateId) {
      const existing = await this.logs.findOne({
        triggeredByEventType: meta.triggeredByEventType,
        triggeredByAggregateId: meta.triggeredByAggregateId,
        template: options.template,
        status: { $in: ['queued', 'sent', 'delivered'] },
      });
      if (existing) {
        return {
          emailLogId: existing._id.toString(),
          providerMessageId: existing.providerMessageId ?? '',
          skipped: true,
        };
      }
    }

    // 2. Guard empty recipient.
    if (!options.to) {
      this.logger.warn(`mail skipped (no recipient) template=${options.template}`);
      return { emailLogId: '', providerMessageId: '', skipped: true };
    }

    // 3. Render.
    const { html, text } = await this.renderer.render(options.template, {
      ...options.data,
      locale: options.locale ?? 'en',
    });

    // 4. Log-first (durable record before dispatch).
    const log = await this.logs.create({
      template: options.template,
      recipientAddress: options.to,
      recipientUserId: options.recipientUserId,
      subject: options.subject,
      status: 'queued',
      providerName: this.provider.name,
      triggeredByEventType: meta.triggeredByEventType,
      triggeredByAggregateId: meta.triggeredByAggregateId,
      correlationId: meta.correlationId,
      locale: options.locale ?? 'en',
      queuedAt: new Date(),
    });

    // 5. Dispatch (store-branded From display name; address stays platform).
    try {
      const result = await this.provider.send({
        from: this.buildFrom(options.senderDisplayName),
        to: options.to,
        replyTo: options.replyTo ?? this.defaultReplyTo,
        subject: options.subject,
        html,
        text,
        attachments: options.attachments,
        tags: meta.triggeredByEventType
          ? [{ name: 'event', value: meta.triggeredByEventType }]
          : undefined,
        idempotencyKey: meta.idempotencyKey,
      });
      log.status = 'sent';
      log.sentAt = new Date();
      log.providerMessageId = result.providerMessageId;
      await log.save();
      return { emailLogId: log._id.toString(), providerMessageId: result.providerMessageId, skipped: false };
    } catch (err) {
      log.status = 'failed';
      log.failedAt = new Date();
      log.failureReason = (err as Error).message;
      log.failureKind = err instanceof PermanentEmailError ? 'provider-rejection' : 'timeout';
      await log.save();
      throw err; // let the worker decide retry (transient) vs drop (permanent)
    }
  }

  private buildFrom(senderDisplayName?: string): string {
    if (!senderDisplayName) return this.defaultFrom;
    const name = senderDisplayName.replace(/["\r\n]/g, '').trim();
    return name ? `"${name}" <${this.defaultFromAddress}>` : this.defaultFrom;
  }
}
